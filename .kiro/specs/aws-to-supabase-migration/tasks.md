# Implementation Plan: AWS → Supabase Migration

## Overview

Migração completa da infraestrutura do RomaneioHub de serviços AWS (Cognito, S3, Secrets Manager, Lambda, Terraform) para Supabase (Auth + Storage), Railway (NestJS containerizado) e Vercel (Next.js). Cada grupo de tarefas é independente o suficiente para ser executado com contexto mínimo do grupo anterior.

## Tasks

- [x] 1. Atualizar dependências e variáveis de ambiente
  - [x] 1.1 Remover dependências AWS e adicionar dependências Supabase no `apps/api/package.json`
    - Remover: `@aws-sdk/client-cognito-identity-provider`, `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `@aws-sdk/client-secrets-manager`, `@codegenie/serverless-express`
    - Adicionar: `@supabase/supabase-js`, `jsonwebtoken`
    - Adicionar em devDependencies: `@types/jsonwebtoken`
    - Executar `npm install` na raiz do monorepo para atualizar `package-lock.json`
    - _Requirements: 1.1, 3.1, 5.2, 7.5_

  - [x] 1.2 Atualizar `.env.example` com variáveis Supabase e remover variáveis AWS
    - Remover: `AWS_REGION`, `AWS_ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SECRET_NAME`, `S3_BUCKET`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`
    - Adicionar: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_ANON_KEY`
    - Adicionar para o frontend: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - Organizar em seções comentadas: `# Database`, `# Supabase`, `# Stripe`, `# Frontend`, `# Application`
    - _Requirements: 5.5, 5.6, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 2. Migrar schema Prisma para nomenclatura agnóstica de provedor
  - [x] 2.1 Atualizar `packages/db/prisma/schema.prisma` com renomeação de campos
    - Renomear `cognitoSub String @unique` → `authId String @unique` no model `User`
    - Renomear `s3Key String` → `storageKey String` no model `Invoice`
    - Adicionar `storageUrl String?` ao model `Invoice`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 2.2 Criar e aplicar migration Prisma
    - Rodar `npx prisma migrate dev --name rename_cognito_s3_to_supabase` em `packages/db`
    - Verificar que a migration gerada usa apenas `RENAME COLUMN` e `ADD COLUMN` (sem perda de dados)
    - SQL esperado: `ALTER TABLE "users" RENAME COLUMN "cognito_sub" TO "auth_id"`, `ALTER TABLE "invoices" RENAME COLUMN "s3_key" TO "storage_key"`, `ALTER TABLE "invoices" ADD COLUMN "storage_url" TEXT`
    - _Requirements: 4.4, 4.5, 4.6_

  - [x] 2.3 Atualizar todas as referências a `cognitoSub` e `s3Key` no código TypeScript
    - Em `apps/api/src/modules/auth/auth.service.ts`: substituir `cognitoSub` por `authId` em todos os `tx.user.create` e `prisma.user.create`
    - Em `apps/api/src/modules/invoices/invoices.service.ts`: substituir `s3Key` por `storageKey` em todos os creates e queries
    - Em `packages/db/prisma/seed.ts` (se existir): atualizar referências
    - Verificar com busca em `apps/` e `packages/`: `grep -r "cognitoSub\|s3Key" --include="*.ts"`
    - _Requirements: 4.7, 4.8_

- [x] 3. Remover SecretsModule e AWS Secrets Manager
  - [x] 3.1 Deletar `apps/api/src/config/secrets.service.ts` e `apps/api/src/config/secrets.module.ts`
    - _Requirements: 5.1_

  - [x] 3.2 Remover `SecretsModule` de `apps/api/src/app.module.ts` e atualizar `apps/api/src/config/index.ts`
    - Em `app.module.ts`: remover import e uso de `SecretsModule`
    - Em `config/index.ts`: remover exports de `SecretsModule`, `SecretsService`, `MANAGED_SECRET_KEYS`, `ManagedSecretKey`
    - Garantir que `DATABASE_URL`, `STRIPE_SECRET_KEY` etc. sejam carregados exclusivamente via `ConfigModule` do NestJS (`process.env`)
    - _Requirements: 5.3, 5.4_

- [x] 4. Implementar SupabaseStorageService
  - [x] 4.1 Criar `apps/api/src/modules/invoices/supabase-storage.service.ts`
    - Inicializar cliente Supabase com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (`persistSession: false`)
    - Implementar `createSignedUploadUrl(key: string, expiresIn: number): Promise<string>` — chama `supabase.storage.from('invoices').createSignedUploadUrl(key)`
    - Implementar `createSignedUrl(key: string, expiresIn: number): Promise<string>` — chama `supabase.storage.from('invoices').createSignedUrl(key, expiresIn)`
    - Implementar `remove(key: string): Promise<void>` — chama `supabase.storage.from('invoices').remove([key])`
    - Definir erros tipados no mesmo arquivo: `StorageUploadUrlError`, `StorageDownloadUrlError`, `StorageDeleteError`
    - _Requirements: 3.2, 3.3, 3.8, 3.9_

  - [x] 4.2 Renomear constante em `packages/shared/src/constants/index.ts`
    - Renomear `INVOICE_S3_KEY_PREFIX` → `INVOICE_STORAGE_KEY_PREFIX` (valor permanece `'notas-fiscais'`)
    - Atualizar comentário JSDoc: `/** Storage key prefix for invoice files */`
    - _Requirements: 3.4_

  - [x] 4.3 Atualizar `apps/api/src/modules/invoices/invoices.service.ts`
    - Substituir import de `S3Service` por `SupabaseStorageService`
    - Substituir import de `INVOICE_S3_KEY_PREFIX` por `INVOICE_STORAGE_KEY_PREFIX`
    - No construtor: substituir `s3Service: S3Service` por `storageService: SupabaseStorageService`
    - Em `generateUploadUrl`: usar `storageService.createSignedUploadUrl(storageKey, ...)` e retornar `{ url, storageKey, expiresIn }`
    - Em `generateDownloadUrl`: usar `storageService.createSignedUrl(invoice.storageKey, ...)`
    - Em `uploadDirect`: usar `storageService.uploadFile` (se mantido) ou adaptar para o novo fluxo de presigned URL
    - Em `getFileStream`: avaliar remoção ou substituição por URL pública/assinada
    - Em `deleteInvoice`: usar `storageService.remove(invoice.storageKey)`
    - Em `registerInvoice`: salvar `storageKey` e `storageUrl` ao criar `Invoice`
    - _Requirements: 3.2, 3.7, 4.8_

  - [x] 4.4 Atualizar `apps/api/src/modules/invoices/invoices.module.ts`
    - Remover `S3Service` dos providers e exports
    - Adicionar `SupabaseStorageService` nos providers
    - _Requirements: 3.1_

  - [x] 4.5 Deletar `apps/api/src/modules/invoices/s3.service.ts`
    - _Requirements: 3.1_

  - [ ]* 4.6 Escrever testes unitários para SupabaseStorageService
    - Criar `apps/api/src/modules/invoices/supabase-storage.service.spec.ts`
    - Mockar cliente `@supabase/supabase-js`
    - Testar `createSignedUploadUrl`: sucesso retorna URL, erro lança `StorageUploadUrlError`
    - Testar `createSignedUrl`: sucesso retorna URL, erro lança `StorageDownloadUrlError`
    - Testar `remove`: sucesso não lança, erro lança `StorageDeleteError`
    - _Requirements: 3.9_

- [~] 5. Checkpoint — storage layer
  - Garantir que todos os testes passem após as mudanças nos grupos 2, 3 e 4.
  - Rodar `npm run test --workspace=@romaneio-hub/api` e verificar sem erros.

- [x] 6. Atualizar JwtAuthGuard para verificação HS256
  - [x] 6.1 Atualizar `apps/api/src/common/interfaces/request-user.interface.ts`
    - Renomear campo `userId: string` → `authId: string` na interface `RequestUser`
    - _Requirements: 2.2_

  - [x] 6.2 Atualizar `apps/api/src/common/guards/jwt-auth.guard.ts`
    - Adicionar import `import * as jwt from 'jsonwebtoken'`
    - Adicionar `import { ConfigService } from '@nestjs/config'` e injetar no construtor
    - Definir interface `SupabaseJwtPayload` com campos: `sub`, `email`, `app_metadata: { tenantId?, globalRole?, tenantRole? }`, `exp`, `iat`
    - Substituir `decodeJwtPayload()` por `jwt.verify(token, SUPABASE_JWT_SECRET, { algorithms: ['HS256'] }) as SupabaseJwtPayload`
    - Extrair claims de `payload.app_metadata`: `tenantId`, `globalRole`, `tenantRole`
    - Popular `request.user` com `{ authId: payload.sub, email, tenantId, globalRole, tenantRole }`
    - Remover método `tryDevHeaders()` e o fallback de dev headers
    - Capturar `jwt.TokenExpiredError` e `jwt.JsonWebTokenError` e lançar `UnauthorizedException('Authentication required: invalid or expired token')`
    - _Requirements: 2.1, 2.2, 2.5_

  - [ ]* 6.3 Atualizar `apps/api/src/common/guards/jwt-auth.guard.spec.ts` para verificação HS256
    - Substituir geração de tokens mock por `jwt.sign()` com `SUPABASE_JWT_SECRET` e `{ algorithm: 'HS256' }`
    - Testar rejeição de token assinado com secret diferente
    - Testar rejeição de token expirado (`expiresIn: -1`)
    - Testar que `request.user.authId` é populado corretamente (em vez de `userId`)
    - Testar que claims são extraídos de `app_metadata`
    - _Requirements: 2.1, 2.5_

- [x] 7. Implementar SupabaseAuthService
  - [x] 7.1 Criar `apps/api/src/modules/auth/supabase-auth.service.ts`
    - Inicializar cliente Supabase Admin com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (`persistSession: false, autoRefreshToken: false`)
    - Implementar `signUp(email, password, name)`: chama `supabase.auth.admin.createUser(...)`, retorna `{ authId, codeDeliveryDestination }`, lança `AuthEmailAlreadyExistsError` se e-mail duplicado
    - Implementar `confirmOtp(email, token)`: chama `supabase.auth.verifyOtp(...)`, lança `AuthInvalidCodeError` ou `AuthExpiredCodeError`
    - Implementar `signIn(email, password)`: chama `supabase.auth.signInWithPassword(...)`, retorna `{ accessToken, refreshToken, expiresIn }`, lança `AuthInvalidCredentialsError` ou `AuthUserNotConfirmedError`
    - Implementar `requestPasswordReset(email)`: chama `supabase.auth.resetPasswordForEmail(email, { redirectTo })`, nunca lança erro (evitar enumeração)
    - Implementar `confirmPasswordReset(accessToken, newPassword)`: cria cliente temporário com `accessToken`, chama `supabaseUserClient.auth.updateUser({ password: newPassword })`, lança `AuthInvalidTokenError`
    - Implementar `deleteUser(authId)`: chama `supabase.auth.admin.deleteUser(authId)`, lança `AuthUserNotFoundError`
    - Definir erros tipados no mesmo arquivo: `AuthEmailAlreadyExistsError`, `AuthInvalidCodeError`, `AuthExpiredCodeError`, `AuthInvalidCredentialsError`, `AuthUserNotConfirmedError`, `AuthInvalidTokenError`, `AuthUserNotFoundError`
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 1.9_

  - [x] 7.2 Atualizar `apps/api/src/modules/auth/auth.service.ts`
    - Substituir import e uso de `CognitoService` por `SupabaseAuthService`
    - Substituir imports de erros Cognito pelos erros de auth Supabase (`AuthEmailAlreadyExistsError` etc.)
    - No método `register`: substituir `cognitoService.signUp()` por `supabaseAuthService.signUp()`, usar `authId` em vez de `cognitoSub` ao criar o `User` no banco
    - No método `confirm`: substituir `cognitoService.confirmSignUp()` por `supabaseAuthService.confirmOtp()`
    - No método `login`: substituir `cognitoService.initiateAuth()` por `supabaseAuthService.signIn()`, retornar apenas `{ accessToken, refreshToken, expiresIn, tokenType }` (sem `idToken`)
    - No método `forgotPassword`: substituir `cognitoService.forgotPassword()` por `supabaseAuthService.requestPasswordReset()`
    - No método `resetPassword`: substituir `cognitoService.confirmForgotPassword()` por `supabaseAuthService.confirmPasswordReset(dto.accessToken, dto.newPassword)` (o fluxo muda de `email+code` para `accessToken+newPassword`)
    - No método `inviteAccountant`: substituir `cognitoSub: 'pending-...'` por `authId: 'pending-...'`
    - Implementar rollback: se a transação Prisma falhar após `signUp`, chamar `supabaseAuthService.deleteUser(authId)` para cleanup
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 4.7_

  - [x] 7.3 Atualizar `apps/api/src/modules/auth/auth.module.ts`
    - Remover import e provider de `CognitoService`
    - Adicionar import e provider de `SupabaseAuthService`
    - Atualizar exports removendo `CognitoService` e adicionando `SupabaseAuthService`
    - _Requirements: 1.1_

  - [x] 7.4 Atualizar `apps/api/src/modules/auth/dev-auth.service.ts`
    - Atualizar o payload JWT gerado para usar `app_metadata: { tenantId, globalRole, tenantRole }` (espelhando a estrutura Supabase)
    - Remover campo `tenantId` do nível raiz do payload (mover para `app_metadata`)
    - _Requirements: 2.2_

  - [x] 7.5 Deletar `apps/api/src/modules/auth/cognito.service.ts`
    - _Requirements: 1.1_

  - [ ]* 7.6 Atualizar `apps/api/src/modules/auth/auth.service.spec.ts`
    - Substituir mock de `CognitoService` por mock de `SupabaseAuthService`
    - Verificar mapeamento de erros: `AuthEmailAlreadyExistsError` → 409, `AuthInvalidCodeError` → 400, `AuthInvalidCredentialsError` → 401
    - Testar rollback: se a transação Prisma falhar após `signUp`, verificar que `supabaseAuthService.deleteUser` é chamado
    - _Requirements: 1.8, 1.9_

- [~] 8. Checkpoint — camada de autenticação
  - Garantir que todos os testes passem após as mudanças nos grupos 6 e 7.
  - Rodar `npm run test --workspace=@romaneio-hub/api` e verificar sem erros de compilação TypeScript.

- [x] 9. Atualizar ambiente Docker e scripts de desenvolvimento
  - [x] 9.1 Atualizar `docker-compose.yml`
    - Remover serviço `localstack` completo
    - No serviço `api`: remover variáveis `AWS_ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET`
    - No serviço `api`: adicionar `SUPABASE_URL: ${SUPABASE_URL}`, `SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY}`, `SUPABASE_JWT_SECRET: ${SUPABASE_JWT_SECRET}`
    - No serviço `web`: adicionar `NEXT_PUBLIC_SUPABASE_URL: ${SUPABASE_URL}`, `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${SUPABASE_ANON_KEY}`
    - Remover dependência `localstack` do serviço `api` em `depends_on`
    - _Requirements: 8.1, 8.4, 8.5_

  - [x] 9.2 Atualizar `apps/api/scripts/dev-entrypoint.sh`
    - Remover quaisquer chamadas de inicialização de S3/LocalStack (criar bucket, configurar credenciais AWS mock)
    - Manter sequência: aguardar PostgreSQL → rodar migrations → seed → iniciar NestJS
    - _Requirements: 8.1, 8.7_

  - [x] 9.3 Atualizar `apps/api/Dockerfile.dev`
    - Remover referências a LocalStack, `awscli` ou scripts de configuração S3
    - _Requirements: 8.1_

  - [x] 9.4 Criar `apps/api/Dockerfile` de produção para Railway
    - Multi-stage build: stage `builder` (node:20-alpine + openssl, instala deps, gera Prisma client, compila TypeScript)
    - Stage `runner` (node:20-alpine + openssl, instala apenas deps de produção, copia artefatos do builder)
    - Expor porta 3001, definir `ENV NODE_ENV=production`
    - Entrypoint: `CMD ["node", "apps/api/dist/main.js"]`
    - _Requirements: 7.6, 8.7_

- [ ] 10. Atualizar CI/CD e remover infraestrutura Terraform
  - [~] 10.1 Atualizar `.github/workflows/deploy.yml`
    - Remover variável de ambiente global `AWS_REGION`
    - Substituir job `deploy-api` (Lambda + Terraform) por job que usa Railway CLI: `npm install -g @railway/cli && railway up --service api --detach`
    - Substituir job `deploy-web` (Amplify + Terraform) por job que usa Vercel CLI: `vercel pull`, `vercel build --prod`, `vercel deploy --prebuilt --prod`
    - Manter jobs `lint`, `test`, `build`, `migrate`, `determine-environment` sem alterações funcionais
    - Remover steps `aws-actions/configure-aws-credentials` e comandos `terraform init/apply`
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

  - [~] 10.2 Atualizar `.github/workflows/README.md`
    - Remover documentação de secrets AWS (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`)
    - Documentar novos secrets necessários: `RAILWAY_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL_DEV`, `DATABASE_URL_PROD`
    - _Requirements: 9.7_

  - [x] 10.3 Remover pasta `infra/` e arquivo Lambda handler
    - Deletar pasta `infra/` completa (arquivos `.tf`, módulos Terraform, estado local)
    - Deletar `apps/api/src/lambda.ts`
    - Verificar `turbo.json` e `package.json` raiz para remover referências a `infra/` ou scripts que invoquem Terraform
    - _Requirements: 7.1, 7.2, 7.5_

  - [~] 10.4 Criar `DEPLOYMENT.md` na raiz do projeto
    - Documentar processo de deploy no Railway: configuração do serviço, variáveis de ambiente, domínio
    - Documentar processo de deploy na Vercel: configuração do projeto, variáveis de ambiente, domínio
    - Listar todos os secrets necessários em cada plataforma
    - _Requirements: 7.3_

- [x] 11. Property-based tests para JWT e storage
  - [x] 11.1 Instalar `fast-check` nas devDependencies de `apps/api`
    - Adicionar `fast-check` ao `apps/api/package.json` devDependencies
    - _Requirements: 2.1_

  - [ ]* 11.2 Escrever property test — Property 1: JWT claims corretos
    - Criar (ou adicionar em) `apps/api/src/common/guards/jwt-auth.guard.spec.ts`
    - **Property 1: JWT claims são corretamente extraídos do payload Supabase**
    - Para qualquer `sub` (UUID), `email`, `tenantId` (UUID), `globalRole` e `tenantRole` válidos — token assinado com `SUPABASE_JWT_SECRET` deve resultar em `request.user` com exatamente esses valores
    - Usar `fc.uuid()`, `fc.emailAddress()`, `fc.constantFrom('ADMIN','SELLER')` etc.
    - Configurar `{ numRuns: 100 }`
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 11.3 Escrever property test — Property 2: JWT inválido sempre rejeitado com 401
    - **Property 2: JWT inválido ou expirado é sempre rejeitado com 401**
    - Cobrir: token assinado com secret diferente, token com `exp` no passado, token malformado
    - Verificar que `UnauthorizedException` é lançada e `request.user` nunca é populado
    - **Validates: Requirements 2.1, 2.5**

  - [ ]* 11.4 Escrever property test — Property 3: Storage key isola o tenant
    - Criar (ou adicionar em) `apps/api/src/modules/invoices/invoices.service.spec.ts`
    - **Property 3: Chave de storage sempre isola o tenant no segundo segmento do path**
    - Para qualquer `tenantId`, `orderId` e `filename` válidos — verificar que a chave segue exatamente `notas-fiscais/{tenantId}/{orderId}/{filename}`
    - Verificar que nenhum `tenantId` pode gerar key com segmento de outro tenant
    - **Validates: Requirements 3.3, 3.4, 10.5**

  - [ ]* 11.5 Escrever property test — Property 4: Validação de content-type e tamanho
    - **Property 4: Validação de content-type e tamanho rejeita todos os inputs inválidos**
    - Para qualquer content-type que não seja `application/pdf`, `image/png`, `image/jpeg` — deve rejeitar com `BadRequestException`
    - Para qualquer `sizeBytes > 10485760` — deve rejeitar com `BadRequestException`
    - Para content-type válido com tamanho dentro do limite — deve prosseguir sem erro
    - **Validates: Requirements 3.5**

- [ ] 12. Atualizar testes unitários afetados pela migração
  - [ ]* 12.1 Atualizar `apps/api/src/modules/invoices/invoices.service.spec.ts`
    - Substituir mock de `S3Service` por mock de `SupabaseStorageService`
    - Atualizar referências de `s3Key` para `storageKey` nos dados de teste
    - Verificar que `InvoicesService` chama os métodos corretos do novo service
    - _Requirements: 3.1, 3.7, 3.8_

  - [ ]* 12.2 Deletar arquivo de spec do SecretsService
    - Deletar `apps/api/src/config/secrets.service.spec.ts` (se existir)
    - _Requirements: 5.1_

- [~] 13. Checkpoint final — todos os testes passando
  - Rodar `npm run test --workspace=@romaneio-hub/api` — garantir que todos os testes passam
  - Rodar `npm run build --workspace=@romaneio-hub/api` — garantir build sem erros TypeScript
  - Verificar ausência de imports de módulos AWS no código com `grep -r "@aws-sdk\|cognito\|localstack" apps/api/src --include="*.ts"`

## Notes

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia os requisitos específicos para rastreabilidade
- Os grupos foram ordenados para minimizar conflitos de merge: schema → remoção de módulos → novos serviços → guard → auth
- Property tests usam a biblioteca `fast-check` (já compatível com Jest/TypeScript)
- O `DevAuthService` é mantido mas atualizado para emitir JWTs com a estrutura `app_metadata` do Supabase, garantindo compatibilidade com o `JwtAuthGuard` atualizado
- A migration Prisma usa apenas `RENAME COLUMN` e `ADD COLUMN` — sem perda de dados existentes
- O `SupabaseStorageService` substitui apenas os métodos de presigned URL e delete; o método `uploadDirect` pode ser avaliado para remoção já que o novo fluxo faz upload direto do cliente para o Supabase Storage

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "4.2"] },
    { "id": 3, "tasks": ["2.3", "4.1", "6.1", "11.1"] },
    { "id": 4, "tasks": ["4.3", "4.4", "6.2", "7.1", "9.2", "9.3", "9.4"] },
    { "id": 5, "tasks": ["4.5", "4.6", "6.3", "7.2", "7.3", "7.4", "9.1", "10.3"] },
    { "id": 6, "tasks": ["7.5", "7.6", "10.1", "10.2", "10.4", "11.2", "11.3"] },
    { "id": 7, "tasks": ["11.4", "11.5", "12.1", "12.2"] }
  ]
}
```
