# Design Document — aws-to-supabase-migration

## Overview

Este documento descreve o design técnico da migração do RomaneioHub de serviços AWS
(Cognito, S3, Secrets Manager, Lambda, Terraform) para uma stack moderna baseada em
Supabase (Auth + Storage + PostgreSQL), Railway (NestJS containerizado) e Vercel (Next.js).

A migração é estritamente **substituição de provedores de infraestrutura** — todos os
fluxos funcionais (autenticação, upload de notas fiscais, assinaturas Stripe, isolamento
multi-tenant) são preservados. As mudanças de API pública são mínimas e limitadas ao
schema Prisma (renomeação de campos).

### Decisões de Design

| Decisão | Escolha | Rationale |
|---------|---------|-----------|
| Validação JWT | `jsonwebtoken` com HS256 | Supabase emite JWTs HS256 com `SUPABASE_JWT_SECRET`; substituição direta sem mudar o guard |
| Custom claims | Supabase Auth Hook (SQL webhook) | Injeta `tenantId`, `globalRole`, `tenantRole` no `app_metadata` no momento do login |
| Storage client | `@supabase/supabase-js` com `service_role` | Garante operações privilegiadas sem expor chaves ao cliente |
| Gestão de secrets | Variáveis de ambiente nas plataformas | Railway e Vercel proveem secrets nativos; elimina dependência do Secrets Manager |
| Deploy API | Container Docker no Railway | NestJS roda melhor como processo persistente do que como Lambda |

---

## Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PRODUÇÃO                                    │
│                                                                      │
│  ┌──────────────┐   HTTPS    ┌──────────────────────────────────┐   │
│  │  Vercel       │ ─────────▶ │  Railway                         │   │
│  │  (Next.js)    │            │  (NestJS — Docker container)     │   │
│  │               │ ◀───────── │                                  │   │
│  └──────────────┘   JSON      │  JwtAuthGuard (HS256)           │   │
│                               │  TenantGuard                    │   │
│  ┌──────────────┐   POST      │  SubscriptionGuard              │   │
│  │  Stripe       │ ─────────▶ │                                  │   │
│  │  (webhooks)   │            └─────────────┬────────────────────┘   │
│  └──────────────┘                           │                        │
│                                             │ Prisma / REST          │
│                               ┌─────────────▼────────────────────┐   │
│                               │  Supabase                         │   │
│                               │  ┌──────────┐  ┌──────────────┐  │   │
│                               │  │ PostgreSQL│  │ Auth (GoTrue)│  │   │
│                               │  └──────────┘  └──────────────┘  │   │
│                               │  ┌──────────────────────────────┐ │   │
│                               │  │ Storage (bucket: invoices)   │ │   │
│                               │  └──────────────────────────────┘ │   │
│                               └──────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘

Fluxo de autenticação:
  1. Cliente (Vercel) → POST /auth/login → Railway (NestJS)
  2. NestJS → supabase.auth.signInWithPassword() → Supabase Auth
  3. Supabase Auth Hook injeta custom claims no JWT (tenantId, globalRole, tenantRole)
  4. NestJS retorna { accessToken, refreshToken, expiresIn } ao cliente
  5. Requisições subsequentes: Bearer <token> → JwtAuthGuard.verify(token, SUPABASE_JWT_SECRET, {algorithms:['HS256']})

Fluxo de upload de nota fiscal:
  1. Cliente → POST /orders/:id/invoices/upload-url → Railway
  2. Railway → supabase.storage.createSignedUploadUrl(key) → Supabase Storage
  3. Railway retorna { uploadUrl, storageKey } ao cliente
  4. Cliente → PUT <uploadUrl> (direto no Supabase Storage, sem passar pelo Railway)
  5. Cliente → POST /orders/:id/invoices/register → Railway (registra Invoice no banco)
```

### Ambiente de Desenvolvimento Local

```
docker-compose up
  ├── postgres:5432      (PostgreSQL local para desenvolvimento sem Supabase CLI)
  ├── api:3001           (NestJS com hot-reload, aponta para Supabase local ou staging)
  ├── web:3000           (Next.js com hot-reload)
  └── stripe-cli         (forwarding de webhooks Stripe)

Alternativa: supabase start (Supabase CLI)
  └── Levanta Auth, Storage e PostgreSQL localmente na porta 54321
```

---

## Components and Interfaces

### 1. SupabaseAuthService

Substitui o `CognitoService`. Localização: `apps/api/src/modules/auth/supabase-auth.service.ts`.

Depende de `@supabase/supabase-js` com o cliente inicializado com `SUPABASE_SERVICE_ROLE_KEY`
(necessário para operações Admin como `createUser` e `deleteUser`).

```typescript
// Inicialização (no construtor)
this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

#### Métodos

**`signUp(email, password, name): Promise<{ authId, codeDeliveryDestination }>`**
- Chama `this.supabase.auth.admin.createUser({ email, password, email_confirm: false, user_metadata: { name } })`
- Supabase envia e-mail de confirmação automaticamente (configurado no dashboard)
- Retorna `{ authId: user.id, codeDeliveryDestination: email }`
- Em caso de e-mail duplicado, Supabase retorna erro com message contendo `already registered`
- Lança `AuthEmailAlreadyExistsError` quando detectado

**`confirmOtp(email, token): Promise<void>`**
- Chama `this.supabase.auth.verifyOtp({ email, token, type: 'email' })`
- Lança `AuthInvalidCodeError` quando o token é inválido
- Lança `AuthExpiredCodeError` quando o token expirou

**`signIn(email, password): Promise<{ accessToken, refreshToken, expiresIn }>`**
- Chama `this.supabase.auth.signInWithPassword({ email, password })`
- Retorna `{ accessToken: session.access_token, refreshToken: session.refresh_token, expiresIn: session.expires_in }`
- Lança `AuthInvalidCredentialsError` quando credenciais são inválidas
- Lança `AuthUserNotConfirmedError` quando o e-mail não foi confirmado

**`requestPasswordReset(email): Promise<void>`**
- Chama `this.supabase.auth.resetPasswordForEmail(email, { redirectTo: FRONTEND_URL + '/reset-password' })`
- Nunca lança erro — retorna silenciosamente mesmo se o e-mail não existir (evita enumeração)

**`confirmPasswordReset(accessToken, newPassword): Promise<void>`**
- Cria cliente temporário com o accessToken do usuário
- Chama `supabaseUserClient.auth.updateUser({ password: newPassword })`
- Lança `AuthInvalidTokenError` quando o token é inválido ou expirou

**`deleteUser(authId): Promise<void>`**
- Chama `this.supabase.auth.admin.deleteUser(authId)`
- Usado exclusivamente para cleanup em caso de falha de transação no banco após `signUp`
- Lança `AuthUserNotFoundError` quando o usuário não existe

#### Erros Tipados

```typescript
export class AuthEmailAlreadyExistsError extends Error {}
export class AuthInvalidCodeError extends Error {}
export class AuthExpiredCodeError extends Error {}
export class AuthInvalidCredentialsError extends Error {}
export class AuthUserNotConfirmedError extends Error {}
export class AuthInvalidTokenError extends Error {}
export class AuthUserNotFoundError extends Error {}
```

O `AuthService` (orquestrador) captura esses erros tipados e os converte em exceções HTTP
(`ConflictException`, `BadRequestException`, `UnauthorizedException`).

---

### 2. JwtAuthGuard Atualizado

Localização: `apps/api/src/common/guards/jwt-auth.guard.ts`.

A mudança central é substituir a decodificação sem verificação criptográfica por
`jsonwebtoken.verify()` com a chave secreta do Supabase.

```typescript
import * as jwt from 'jsonwebtoken';

interface SupabaseJwtPayload {
  sub: string;           // authId do usuário no Supabase Auth
  email: string;
  app_metadata: {
    tenantId?: string;
    globalRole?: string;
    tenantRole?: string;
  };
  exp: number;
  iat: number;
}

// Dentro de canActivate():
const token = authHeader.slice(7);
let payload: SupabaseJwtPayload;

try {
  payload = jwt.verify(token, SUPABASE_JWT_SECRET, {
    algorithms: ['HS256'],
  }) as SupabaseJwtPayload;
} catch (err) {
  // jwt.TokenExpiredError, jwt.JsonWebTokenError — nunca revelar detalhes
  throw new UnauthorizedException('Authentication required: invalid or expired token');
}

request.user = {
  authId:     payload.sub,
  email:      payload.email,
  tenantId:   payload.app_metadata?.tenantId,
  globalRole: payload.app_metadata?.globalRole ?? 'SELLER',
  tenantRole: payload.app_metadata?.tenantRole,
};
```

**Mudanças em relação à implementação atual:**
- Remove `decodeJwtPayload()` (decodificação sem verificação)
- Remove fallback de dev headers (ambiente local usa JWT real via Supabase local CLI)
- Passa a ler claims de `app_metadata` em vez de claims de nível raiz (`custom:tenantId`)
- Campo `userId` renomeado para `authId` em `request.user`

---

### 3. Supabase Auth Hook — Injeção de Custom Claims

O Supabase Auth Hook é uma **Supabase Database Function** do tipo `JWT Claims Customization`
(disponível em Auth > Hooks no dashboard do Supabase). A função é chamada pelo GoTrue antes
de emitir o JWT, no momento do login.

#### SQL da Edge Function / Database Hook

```sql
-- Supabase Hook: customize_access_token
-- Evento: auth.users (login)
-- Localização: Supabase Dashboard > Authentication > Hooks > "Customize Access Token (JWT) Claim"

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims jsonb;
  user_tenant record;
BEGIN
  -- Obtém os claims existentes do JWT
  claims := event -> 'claims';

  -- Busca a associação UserTenant ativa para este usuário
  -- O campo auth_id no modelo User corresponde ao event->>'user_id' (UUID do Supabase Auth)
  SELECT
    ut.tenant_id,
    u.global_role,
    ut.role AS tenant_role
  INTO user_tenant
  FROM user_tenants ut
  INNER JOIN users u ON u.id = ut.user_id
  WHERE u.auth_id = (event->>'user_id')
    AND ut.status = 'ACCEPTED'
  LIMIT 1;

  -- Injeta custom claims no app_metadata se o usuário tiver tenant associado
  IF user_tenant IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata}',
      COALESCE(claims->'app_metadata', '{}'::jsonb)
      || jsonb_build_object(
        'tenantId',   user_tenant.tenant_id,
        'globalRole', user_tenant.global_role,
        'tenantRole', user_tenant.tenant_role
      )
    );
  END IF;

  -- Retorna o evento com claims atualizados
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant execute para o role do hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
```

**Configuração no Dashboard:**
1. Supabase Dashboard → Authentication → Hooks
2. "Customize Access Token (JWT) Claim" → Enable
3. Selecionar: `public.custom_access_token_hook`

**Consideração:** O Supabase Auth Hook substitui a necessidade de qualquer configuração de
`trigger` manual — é um mecanismo oficial do Supabase para customização de claims.

---

### 4. SupabaseStorageService

Substitui o `S3Service`. Localização: `apps/api/src/modules/invoices/supabase-storage.service.ts`.

```typescript
// Inicialização (no construtor)
this.supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
this.bucket = 'invoices';
```

#### Métodos

**`createSignedUploadUrl(key: string, expiresIn: number): Promise<string>`**
```typescript
const { data, error } = await this.supabase.storage
  .from(this.bucket)
  .createSignedUploadUrl(key);

if (error) throw new StorageUploadUrlError(error.message);
return data.signedUrl;
```

**`createSignedUrl(key: string, expiresIn: number): Promise<string>`**
```typescript
const { data, error } = await this.supabase.storage
  .from(this.bucket)
  .createSignedUrl(key, expiresIn);

if (error) throw new StorageDownloadUrlError(error.message);
return data.signedUrl;
```

**`remove(key: string): Promise<void>`**
```typescript
const { error } = await this.supabase.storage
  .from(this.bucket)
  .remove([key]);

if (error) throw new StorageDeleteError(error.message);
```

#### Geração de chave de storage

O `InvoicesService` constrói a chave seguindo o padrão:
```typescript
const storageKey = `notas-fiscais/${tenantId}/${orderId}/${filename}`;
```

O prefixo muda de `INVOICE_S3_KEY_PREFIX` (`notas-fiscais`) para `INVOICE_STORAGE_KEY_PREFIX`
na package `@romaneio-hub/shared`.

#### Erros Tipados

```typescript
export class StorageUploadUrlError extends Error {}
export class StorageDownloadUrlError extends Error {}
export class StorageDeleteError extends Error {}
```

---

## Data Models

### Migração do Schema Prisma

#### Diff do Schema

**Model `User` — renomear `cognitoSub` → `authId`:**

```diff
 model User {
   id           String     @id @default(uuid())
-  cognitoSub   String     @unique
+  authId       String     @unique
   email        String     @unique
   name         String
   globalRole   GlobalRole @default(SELLER)
   mfaEnabled   Boolean    @default(false)
   passwordHash String?
   createdAt    DateTime   @default(now())
   updatedAt    DateTime   @updatedAt

   tenants      UserTenant[]
   auditRecords AuditLog[]
 }
```

**Model `Invoice` — renomear `s3Key` → `storageKey` e adicionar `storageUrl`:**

```diff
 model Invoice {
   id           String          @id @default(uuid())
   orderId      String
   category     InvoiceCategory @default(PURCHASE)
   filename     String
-  s3Key        String
+  storageKey   String
+  storageUrl   String?
   contentType  String
   sizeBytes    Int
   uploadedAt   DateTime        @default(now())
   uploadedById String

   order Order @relation(fields: [orderId], references: [id])

   @@index([orderId])
 }
```

#### SQL da Migration Gerada

```sql
-- Migration: YYYYMMDDHHMMSS_rename_cognito_s3_to_supabase

-- Rename cognito_sub to auth_id na tabela users
ALTER TABLE "users" RENAME COLUMN "cognito_sub" TO "auth_id";

-- Rename s3_key to storage_key na tabela invoices
ALTER TABLE "invoices" RENAME COLUMN "s3_key" TO "storage_key";

-- Adiciona storage_url como coluna nullable
ALTER TABLE "invoices" ADD COLUMN "storage_url" TEXT;
```

Esta migration usa apenas `RENAME COLUMN` e `ADD COLUMN` — sem perda de dados, sem
conversão de tipo, sem truncamento. Dados existentes nas colunas renomeadas são preservados
integralmente.

---

## Environment Variables

### Tabela Completa de Variáveis de Ambiente

| Variável | Descrição | Onde usar | Obrigatório |
|---|---|---|---|
| `DATABASE_URL` | URL de conexão PostgreSQL para Prisma | Backend | ✅ |
| `SUPABASE_URL` | URL do projeto Supabase (ex: `https://xxx.supabase.co`) | Backend | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço do Supabase (privilégios admin) | Backend | ✅ |
| `SUPABASE_JWT_SECRET` | Chave secreta para verificar assinaturas JWT HS256 | Backend | ✅ |
| `SUPABASE_ANON_KEY` | Chave pública anônima do Supabase | Backend (opcional) | ❌ |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do Supabase exposta ao browser | Frontend | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anônima exposta ao browser | Frontend | ✅ |
| `STRIPE_SECRET_KEY` | Chave secreta da API Stripe | Backend | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Secret de assinatura dos webhooks Stripe | Backend | ✅ |
| `STRIPE_MONTHLY_PRICE_ID` | Price ID do plano mensal no Stripe | Backend | ✅ |
| `STRIPE_SEMIANNUAL_PRICE_ID` | Price ID do plano semestral no Stripe | Backend | ✅ |
| `STRIPE_ANNUAL_PRICE_ID` | Price ID do plano anual no Stripe | Backend | ✅ |
| `CORS_ORIGIN` | Origem permitida pelo CORS (URL do frontend) | Backend | ✅ |
| `FRONTEND_URL` | URL do frontend usada em e-mails e redirects | Backend | ✅ |
| `NEXT_PUBLIC_API_URL` | URL da API acessível do browser | Frontend | ✅ |
| `NODE_ENV` | Ambiente: `development` \| `staging` \| `production` | Ambos | ✅ |
| `PORT` | Porta do servidor NestJS (padrão: 3001) | Backend | ❌ |

**Variáveis removidas:** `AWS_REGION`, `AWS_ENDPOINT`, `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `AWS_SECRET_NAME`, `S3_BUCKET`, `COGNITO_USER_POOL_ID`,
`COGNITO_CLIENT_ID`.

### .env.example Atualizado

```dotenv
# =============================================================================
# RomaneioHub — Environment Variables
# =============================================================================

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/romaneio_hub

# Supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_ANON_KEY=your-anon-key

# Stripe
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
STRIPE_MONTHLY_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxx
STRIPE_SEMIANNUAL_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxx
STRIPE_ANNUAL_PRICE_ID=price_xxxxxxxxxxxxxxxxxxxx

# Frontend
CORS_ORIGIN=http://localhost:3000
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Application
NODE_ENV=development
PORT=3001
```

---

## Docker Compose Atualizado

```yaml
# docker-compose.yml — sem LocalStack, com variáveis Supabase
services:
  postgres:
    image: postgres:16-alpine
    container_name: romaneio-hub-postgres
    environment:
      POSTGRES_DB: romaneio_hub
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres -d romaneio_hub']
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s
    restart: unless-stopped

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile.dev
    container_name: romaneio-hub-api
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/romaneio_hub
      SUPABASE_URL: ${SUPABASE_URL}
      SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}
      SUPABASE_JWT_SECRET: ${SUPABASE_JWT_SECRET}
      CORS_ORIGIN: http://localhost:3000
      FRONTEND_URL: http://localhost:3000
      NODE_ENV: development
    ports:
      - '3001:3001'
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ['CMD-SHELL', 'curl -sf http://localhost:3001/health || exit 1']
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    volumes:
      - ./apps/api/src:/app/apps/api/src
      - ./packages:/app/packages
      - /app/node_modules
      - /app/apps/api/node_modules
    restart: unless-stopped

  stripe-cli:
    image: stripe/stripe-cli:latest
    container_name: romaneio-hub-stripe-cli
    command: listen --forward-to http://api:3001/subscriptions/webhook
    environment:
      STRIPE_API_KEY: ${STRIPE_SECRET_KEY}
    depends_on:
      api:
        condition: service_healthy
    restart: unless-stopped

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile.dev
    container_name: romaneio-hub-web
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
      NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL}
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}
      NODE_ENV: development
    ports:
      - '3000:3000'
    depends_on:
      api:
        condition: service_healthy
    volumes:
      - ./apps/web/src:/app/apps/web/src
      - ./packages:/app/packages
      - /app/node_modules
      - /app/apps/web/node_modules
    restart: unless-stopped

volumes:
  pgdata:
    driver: local
```

**Mudanças em relação ao docker-compose atual:**
- Serviço `localstack` removido
- Variáveis AWS removidas do serviço `api`
- Variáveis `SUPABASE_*` adicionadas via `${VAR}` (lidas do `.env` local)
- Variáveis Supabase adicionadas ao serviço `web`

---

## Dockerfiles

### `apps/api/Dockerfile` (produção — Railway)

```dockerfile
# =============================================================================
# RomaneioHub API — Production Dockerfile (Railway)
# =============================================================================
# Multi-stage build: builder instala dependências e compila TypeScript,
# runner copia apenas o necessário para a imagem final.
# =============================================================================

# Stage 1: Builder
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

# Copia arquivos de manifesto para resolver workspace
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

# Instala todas as dependências (incluindo devDependencies para build)
RUN npm ci

# Copia schema Prisma e gera o client
COPY packages/db/prisma ./packages/db/prisma
RUN npx prisma generate --schema=./packages/db/prisma/schema.prisma

# Copia código fonte
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Compila TypeScript
RUN npm run build -w apps/api

# Stage 2: Runner
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

# Copia manifesto para instalar apenas dependências de produção
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --omit=dev

# Copia Prisma client gerado e schema
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY packages/db/prisma ./packages/db/prisma

# Copia artefatos compilados
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "apps/api/dist/main.js"]
```

### `apps/api/Dockerfile.dev` (desenvolvimento — sem alterações estruturais)

```dockerfile
# =============================================================================
# RomaneioHub API — Development Dockerfile
# =============================================================================
# Suporte a hot-reload via NestJS --watch. Executa migrations e seed no startup.
# Sem LocalStack. Usa variáveis Supabase do .env local.
# =============================================================================

FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci

COPY packages/db/prisma ./packages/db/prisma
RUN npx prisma generate --schema=./packages/db/prisma/schema.prisma

COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

COPY apps/api/scripts/dev-entrypoint.sh ./apps/api/scripts/dev-entrypoint.sh
RUN chmod +x ./apps/api/scripts/dev-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./apps/api/scripts/dev-entrypoint.sh"]
```

**Mudança:** Remove qualquer referência a `localstack` ou scripts de inicialização do S3.

---

## CI/CD — GitHub Actions Atualizado

### `.github/workflows/deploy.yml`

```yaml
name: Deploy

on:
  push:
    branches: [main]
  release:
    types: [published]

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-lint-${{ runner.os }}-${{ hashFiles('**/turbo.json') }}-${{ github.sha }}
          restore-keys: |
            turbo-lint-${{ runner.os }}-${{ hashFiles('**/turbo.json') }}-
      - run: turbo run lint

  test:
    name: Test
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-test-${{ runner.os }}-${{ hashFiles('**/turbo.json') }}-${{ github.sha }}
          restore-keys: |
            turbo-test-${{ runner.os }}-${{ hashFiles('**/turbo.json') }}-
      - run: turbo run test

  build:
    name: Build
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-build-${{ runner.os }}-${{ hashFiles('**/turbo.json') }}-${{ github.sha }}
          restore-keys: |
            turbo-build-${{ runner.os }}-${{ hashFiles('**/turbo.json') }}-
      - run: turbo run build

  determine-environment:
    name: Determine Environment
    runs-on: ubuntu-latest
    outputs:
      environment: ${{ steps.env.outputs.environment }}
      database_url_secret: ${{ steps.env.outputs.database_url_secret }}
    steps:
      - name: Set environment
        id: env
        run: |
          if [[ "${{ github.event_name }}" == "release" ]]; then
            echo "environment=prod" >> $GITHUB_OUTPUT
            echo "database_url_secret=DATABASE_URL_PROD" >> $GITHUB_OUTPUT
          else
            echo "environment=dev" >> $GITHUB_OUTPUT
            echo "database_url_secret=DATABASE_URL_DEV" >> $GITHUB_OUTPUT
          fi

  migrate:
    name: Database Migration
    needs: [build, determine-environment]
    runs-on: ubuntu-latest
    environment: ${{ needs.determine-environment.outputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - name: Generate Prisma Client
        run: npx prisma generate
        working-directory: packages/db
      - name: Run Prisma Migrate Deploy
        run: npx prisma migrate deploy
        working-directory: packages/db
        env:
          DATABASE_URL: ${{ secrets[needs.determine-environment.outputs.database_url_secret] }}

  deploy-api:
    name: Deploy API (Railway)
    needs: [migrate, determine-environment]
    runs-on: ubuntu-latest
    environment: ${{ needs.determine-environment.outputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - name: Install Railway CLI
        run: npm install -g @railway/cli
      - name: Deploy to Railway
        run: railway up --service api --detach
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

  deploy-web:
    name: Deploy Web (Vercel)
    needs: [migrate, determine-environment]
    runs-on: ubuntu-latest
    environment: ${{ needs.determine-environment.outputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - name: Install Vercel CLI
        run: npm install -g vercel
      - name: Deploy to Vercel
        run: |
          vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
          vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
          vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
        env:
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

**Mudanças em relação ao workflow atual:**
- Removido: `aws-actions/configure-aws-credentials`, secrets `AWS_*`, steps `terraform`
- Removido: jobs `deploy-api` com Lambda e Terraform
- Removido: job `deploy-web` com Amplify e Terraform
- Adicionado: job `deploy-api` com Railway CLI
- Adicionado: job `deploy-web` com Vercel CLI
- Mantido: jobs `lint`, `test`, `build`, `migrate`, `determine-environment` sem alterações funcionais

### Secrets necessários no GitHub

| Secret | Descrição |
|---|---|
| `RAILWAY_TOKEN` | Token de autenticação da Railway CLI |
| `VERCEL_TOKEN` | Token de autenticação da Vercel CLI |
| `VERCEL_ORG_ID` | ID da organização no Vercel |
| `VERCEL_PROJECT_ID` | ID do projeto web no Vercel |
| `DATABASE_URL_DEV` | URL PostgreSQL para o ambiente de dev |
| `DATABASE_URL_PROD` | URL PostgreSQL para o ambiente de produção |

---

## File Structure — Criar / Modificar / Deletar

### Arquivos a Criar

| Arquivo | Descrição |
|---|---|
| `apps/api/src/modules/auth/supabase-auth.service.ts` | Substitui `cognito.service.ts` |
| `apps/api/Dockerfile` | Dockerfile de produção para Railway |
| `supabase/migrations/YYYYMMDDHHMMSS_custom_claims_hook.sql` | SQL do Auth Hook |
| `DEPLOYMENT.md` | Documentação de deploy no Railway e Vercel |
| `docs/development.md` | Guia de desenvolvimento local sem LocalStack |

### Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `apps/api/src/modules/auth/auth.service.ts` | Substituir `CognitoService` por `SupabaseAuthService`; `cognitoSub` → `authId` |
| `apps/api/src/modules/auth/auth.module.ts` | Remover `CognitoService`, adicionar `SupabaseAuthService` |
| `apps/api/src/common/guards/jwt-auth.guard.ts` | Verificação HS256 com `jsonwebtoken`; claims de `app_metadata` |
| `apps/api/src/modules/invoices/invoices.service.ts` | `S3Service` → `SupabaseStorageService`; `s3Key` → `storageKey` |
| `apps/api/src/modules/invoices/invoices.module.ts` | Remover `S3Service`, adicionar `SupabaseStorageService` |
| `apps/api/src/config/index.ts` | Remover export do `SecretsModule`/`SecretsService` |
| `apps/api/src/app.module.ts` | Remover `SecretsModule` dos imports |
| `packages/db/prisma/schema.prisma` | `cognitoSub` → `authId`; `s3Key` → `storageKey`; add `storageUrl` |
| `packages/shared/src/constants.ts` | `INVOICE_S3_KEY_PREFIX` → `INVOICE_STORAGE_KEY_PREFIX` |
| `docker-compose.yml` | Remover `localstack`, variáveis AWS; adicionar variáveis Supabase |
| `apps/api/Dockerfile.dev` | Remover referências a LocalStack/S3 init scripts |
| `.env.example` | Remover vars AWS; adicionar vars Supabase |
| `.github/workflows/deploy.yml` | Remover AWS/Terraform; adicionar Railway/Vercel |
| `README.md` | Remover referências AWS/Lambda/Amplify/Terraform |
| `turbo.json` | Remover referências à pasta `infra/` se existirem |
| `apps/api/package.json` | Remover `@aws-sdk/*`, `@codegenie/serverless-express`; adicionar `@supabase/supabase-js`, `jsonwebtoken` |

### Arquivos a Deletar

| Arquivo | Motivo |
|---|---|
| `apps/api/src/modules/auth/cognito.service.ts` | Substituído por `supabase-auth.service.ts` |
| `apps/api/src/modules/invoices/s3.service.ts` | Substituído por `supabase-storage.service.ts` |
| `apps/api/src/config/secrets.service.ts` | SecretsModule removido |
| `apps/api/src/lambda.ts` | Handler Lambda não necessário no Railway |
| `infra/` (pasta completa) | Terraform removido; Railway e Vercel gerenciados via dashboard/CLI |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Esta feature envolve lógica pura testável por PBT: verificação de JWT, geração de caminhos de storage, isolamento de tenant e transições de status de subscription. A biblioteca escolhida é **`fast-check`** (TypeScript/Jest), configurada com mínimo de 100 iterações por propriedade.

---

### Property 1: JWT claims são corretamente extraídos do payload Supabase

*Para qualquer* JWT válido assinado com `SUPABASE_JWT_SECRET` contendo os campos `sub`, `email` e `app_metadata.tenantId`, `app_metadata.globalRole`, `app_metadata.tenantRole` — o `JwtAuthGuard` deve popular `request.user` com exatamente esses valores, sem perda nem alteração de claim.

**Validates: Requirements 2.1, 2.2**

---

### Property 2: JWT inválido ou expirado é sempre rejeitado com 401

*Para qualquer* token que seja assinado com um secret diferente de `SUPABASE_JWT_SECRET`, ou cujo campo `exp` esteja no passado, ou que tenha estrutura malformada — o `JwtAuthGuard` deve lançar `UnauthorizedException` e nunca popular `request.user`.

**Validates: Requirements 2.1, 2.5**

---

### Property 3: Chave de storage sempre isola o tenant no segundo segmento do path

*Para qualquer* combinação de `tenantId`, `orderId` e `filename` válidos — a chave de storage gerada pelo `InvoicesService` deve seguir exatamente o padrão `notas-fiscais/{tenantId}/{orderId}/{filename}`, garantindo que o `tenantId` está sempre presente no segundo segmento do path e que nenhuma requisição de um tenant A pode gerar uma chave com o `tenantId` de um tenant B.

**Validates: Requirements 3.3, 3.4, 10.5**

---

### Property 4: Validação de content-type e tamanho rejeita todos os inputs inválidos

*Para qualquer* content-type que não seja `application/pdf`, `image/png` ou `image/jpeg` — a validação do `InvoicesService` deve rejeitar com `BadRequestException`. *Para qualquer* `sizeBytes` maior que 10.485.760 (10 MB) — a validação deve rejeitar com `BadRequestException`. *Para qualquer* content-type válido com `sizeBytes` dentro do limite — deve aceitar e prosseguir.

**Validates: Requirements 3.5**

---

### Property 5: Transições de status de subscription são válidas no grafo de estados

*Para qualquer* estado inicial válido de `SubscriptionStatus` e *para qualquer* evento Stripe processado (webhook `customer.subscription.updated`, `invoice.payment_failed`, `invoice.payment_succeeded`, `customer.subscription.deleted`) — o estado resultante deve ser um estado válido no grafo de transições e nunca deve saltar para um estado inalcançável a partir do estado atual.

O grafo de transições válidas é:
```
TRIAL        → ACTIVE, CANCELLED
ACTIVE       → PAST_DUE, CANCELLED
PAST_DUE     → GRACE_PERIOD, ACTIVE
GRACE_PERIOD → BLOCKED, ACTIVE
BLOCKED      → ACTIVE, CANCELLED
CANCELLED    → (terminal)
```

**Validates: Requirements 10.6**

---

### Property 6: Registro de usuário sempre cria User + Tenant + UserTenant(PENDING) atomicamente

*Para qualquer* combinação válida de `email`, `password`, `name` e `companyName` — quando o `AuthService.register()` é chamado (com mock do `SupabaseAuthService`), a transação Prisma deve criar exatamente um `User`, um `Tenant` e um `UserTenant` com `status = 'PENDING'`, ou falhar completamente sem criar registros parciais.

**Validates: Requirements 1.3**

---

## Error Handling

### Hierarquia de erros e mapeamento HTTP

| Erro interno | HTTP Status | Contexto |
|---|---|---|
| `AuthEmailAlreadyExistsError` | 409 Conflict | Registro com e-mail duplicado |
| `AuthInvalidCodeError` | 400 Bad Request | OTP inválido na confirmação |
| `AuthExpiredCodeError` | 400 Bad Request | OTP expirado na confirmação |
| `AuthInvalidCredentialsError` | 401 Unauthorized | Login com senha errada |
| `AuthUserNotConfirmedError` | 401 Unauthorized | Login antes de confirmar e-mail |
| `AuthInvalidTokenError` | 400 Bad Request | Token de reset de senha inválido |
| `StorageUploadUrlError` | 500 Internal Server Error | Falha ao gerar URL de upload |
| `StorageDownloadUrlError` | 500 Internal Server Error | Falha ao gerar URL de download |
| `StorageDeleteError` | 500 Internal Server Error | Falha ao deletar arquivo |
| `jwt.TokenExpiredError` | 401 Unauthorized | JWT expirado no JwtAuthGuard |
| `jwt.JsonWebTokenError` | 401 Unauthorized | JWT com assinatura inválida |

### Rollback de transação no registro

Quando `AuthService.register()` cria o usuário no Supabase Auth e em seguida a transação
Prisma falha (ex.: banco indisponível), o serviço chama `SupabaseAuthService.deleteUser(authId)`
para fazer cleanup do usuário órfão no Supabase. Falhas no cleanup são logadas mas não
relançadas — o cliente recebe 500 e pode tentar novamente.

### Logs de segurança

Erros de autenticação são logados com nível `warn` incluindo apenas `email` (sem senha,
sem token, sem secret). Erros de infraestrutura (storage, banco) são logados com nível
`error` incluindo o stack trace, mas nunca incluindo `SUPABASE_SERVICE_ROLE_KEY` ou
`SUPABASE_JWT_SECRET`.

---

## Testing Strategy

### Abordagem Dual

A estratégia combina testes de unidade (exemplos e edge cases) com testes baseados em
propriedades (PBT via `fast-check`) para cobertura abrangente.

**Unit tests** cobrem:
- Exemplos específicos de cada fluxo (registro, login, confirmação, reset)
- Edge cases de validação (content-type inválido, arquivo > 10 MB, OTP expirado)
- Mapeamento de erros internos para exceções HTTP

**Property tests** cobrem:
- Corretude universal do JwtAuthGuard para qualquer JWT válido/inválido
- Isolamento de tenant na geração de storage keys para qualquer combinação de IDs
- Validação de content-type/tamanho para todo o espaço de inputs
- Grafo de transições de subscription para qualquer sequência de eventos Stripe
- Atomicidade do registro para qualquer input válido

### Biblioteca PBT

**`fast-check`** (já compatível com Jest/TypeScript, zero configuração adicional).

```typescript
// Instalação
npm install --save-dev fast-check

// Configuração de iterações (jest.config.ts ou por teste)
// fast-check usa 100 iterações por padrão — explicitamente configurar:
fc.assert(fc.property(...), { numRuns: 100 });
```

### Exemplos de Implementação PBT

#### Property 1 — JWT claims extraídos corretamente

```typescript
// Feature: aws-to-supabase-migration, Property 1: JWT claims corretos após login
it('extrai corretamente todos os claims do JWT Supabase', () => {
  fc.assert(
    fc.property(
      fc.uuid(),        // sub / authId
      fc.emailAddress(), // email
      fc.uuid(),        // tenantId
      fc.constantFrom('ADMIN', 'SELLER'), // globalRole
      fc.constantFrom('SELLER', 'ACCOUNTING_MANAGER', 'ACCOUNTING_VIEWER'), // tenantRole
      (sub, email, tenantId, globalRole, tenantRole) => {
        const token = jwt.sign(
          { sub, email, app_metadata: { tenantId, globalRole, tenantRole } },
          SUPABASE_JWT_SECRET,
          { algorithm: 'HS256', expiresIn: '1h' },
        );
        const user = extractUserFromToken(token);
        expect(user.authId).toBe(sub);
        expect(user.email).toBe(email);
        expect(user.tenantId).toBe(tenantId);
        expect(user.globalRole).toBe(globalRole);
        expect(user.tenantRole).toBe(tenantRole);
      },
    ),
    { numRuns: 100 },
  );
});
```

#### Property 3 — Storage key isola o tenant

```typescript
// Feature: aws-to-supabase-migration, Property 3: Isolamento de storage path
it('a chave de storage sempre contém o tenantId correto no segundo segmento', () => {
  fc.assert(
    fc.property(
      fc.uuid(), // tenantId
      fc.uuid(), // orderId
      fc.string({ minLength: 1, maxLength: 64 }).filter(s => !s.includes('/')), // filename
      (tenantId, orderId, filename) => {
        const key = buildStorageKey(tenantId, orderId, filename);
        const segments = key.split('/');
        expect(segments[0]).toBe('notas-fiscais');
        expect(segments[1]).toBe(tenantId);
        expect(segments[2]).toBe(orderId);
        expect(segments[3]).toBe(filename);
      },
    ),
    { numRuns: 100 },
  );
});
```

#### Property 5 — Transições de subscription

```typescript
// Feature: aws-to-supabase-migration, Property 5: Transições de subscription válidas
it('processamento de webhook Stripe sempre resulta em estado de subscription válido', () => {
  const validStates = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'BLOCKED', 'CANCELLED'];
  const validTransitions: Record<string, string[]> = {
    TRIAL: ['ACTIVE', 'CANCELLED'],
    ACTIVE: ['PAST_DUE', 'CANCELLED'],
    PAST_DUE: ['GRACE_PERIOD', 'ACTIVE'],
    GRACE_PERIOD: ['BLOCKED', 'ACTIVE'],
    BLOCKED: ['ACTIVE', 'CANCELLED'],
    CANCELLED: [],
  };
  fc.assert(
    fc.property(
      fc.constantFrom(...validStates),
      fc.constantFrom('invoice.payment_succeeded', 'invoice.payment_failed', 'customer.subscription.deleted'),
      (initialStatus, eventType) => {
        const resultStatus = applyStripeEvent(initialStatus, eventType);
        const reachable = validTransitions[initialStatus];
        // Se há transição, deve ser válida; se não há, deve permanecer no estado atual
        if (resultStatus !== initialStatus) {
          expect(reachable).toContain(resultStatus);
        }
        expect(validStates).toContain(resultStatus);
      },
    ),
    { numRuns: 100 },
  );
});
```

### Cobertura por Requisito

| Requisito | Tipo de Teste | Property # |
|---|---|---|
| 1.3 Registro cria User+Tenant+UserTenant atomicamente | Property | 6 |
| 1.5 Login retorna tokens corretos | Unit (example) | — |
| 1.8 E-mail duplicado retorna 409 | Unit (example) | — |
| 2.1 JwtAuthGuard verifica HS256 | Property | 1, 2 |
| 2.2 Claims extraídos para request.user | Property | 1 |
| 2.4 JWT sem tenantId rejeitado | Property (edge case no gen. de 2) | 2 |
| 3.3 Presigned URL gerada para upload | Unit (mock) | — |
| 3.4 Path de storage segue padrão correto | Property | 3 |
| 3.5 Validação content-type e tamanho | Property | 4 |
| 10.5 Isolamento multi-tenant mantido | Property | 3 |
| 10.6 Transições de subscription válidas | Property | 5 |
