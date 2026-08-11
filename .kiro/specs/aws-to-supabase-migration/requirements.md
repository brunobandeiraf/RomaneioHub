# Requirements Document

## Introduction

Migração completa da infraestrutura do RomaneioHub de serviços AWS para uma stack moderna baseada em Supabase (Auth + Storage + PostgreSQL), Railway (deploy do backend NestJS) e Vercel (deploy do frontend Next.js). A migração preserva todos os fluxos funcionais existentes — autenticação, upload de notas fiscais, assinatura Stripe, isolamento multi-tenant — enquanto elimina a dependência do AWS SDK, Terraform, LocalStack e AWS Secrets Manager. O schema Prisma é ajustado para nomenclatura agnóstica de provedor de storage, e o ambiente de desenvolvimento local é simplificado.

## Glossary

- **Plataforma**: O sistema completo RomaneioHub (frontend Next.js + backend NestJS + banco PostgreSQL)
- **Supabase**: Plataforma BaaS (Backend as a Service) utilizada para Auth, Storage e PostgreSQL
- **SupabaseAuthService**: Novo serviço NestJS que substitui o `CognitoService`, responsável por todos os fluxos de autenticação via Supabase Auth
- **SupabaseStorageService**: Novo serviço NestJS que substitui o `S3Service`, responsável pelo upload e download de notas fiscais via Supabase Storage
- **SUPABASE_JWT_SECRET**: Chave secreta própria do projeto Supabase utilizada para verificar assinaturas de JWT no NestJS
- **SUPABASE_SERVICE_ROLE_KEY**: Chave de serviço do Supabase com privilégios administrativos, usada no backend para operações de Storage e Auth Admin
- **SUPABASE_ANON_KEY**: Chave pública anônima do Supabase, utilizada no frontend Next.js
- **Custom Claims**: Metadados adicionados ao JWT pelo Supabase Auth Hook (Database Webhook ou Edge Function), contendo `tenantId`, `globalRole` e `tenantRole`
- **authId**: Identificador único do usuário no provedor de autenticação (substitui o campo `cognitoSub` no model `User` do Prisma)
- **storageKey**: Caminho do arquivo no bucket do Supabase Storage (substitui o campo `s3Key` no model `Invoice` do Prisma)
- **storageUrl**: URL pré-assinada em cache ou URL pública do arquivo no Supabase Storage (novo campo no model `Invoice`)
- **Bucket `invoices`**: Bucket privado no Supabase Storage que armazena as notas fiscais
- **Railway**: Plataforma PaaS para deploy do backend NestJS como container Docker
- **Vercel**: Plataforma para deploy do frontend Next.js
- **Supabase CLI**: Ferramenta de linha de comando para rodar o Supabase localmente em desenvolvimento
- **JwtAuthGuard**: Guard global do NestJS que valida tokens JWT usando `SUPABASE_JWT_SECRET`
- **TenantGuard**: Guard global do NestJS que extrai e valida o `tenantId` do payload JWT
- **Presigned URL**: URL temporária assinada pelo Supabase Storage para operações diretas de upload (PUT) ou download (GET) sem expor credenciais

## Requirements

### Requisito 1: Migração do Serviço de Autenticação

**User Story:** Como desenvolvedor, quero substituir o CognitoService pelo SupabaseAuthService, para que a autenticação use Supabase Auth e o sistema pare de depender do AWS SDK e das credenciais da AWS.

#### Critérios de Aceite

1. THE Plataforma SHALL remover a dependência `@aws-sdk/client-cognito-identity-provider` do `apps/api/package.json` e eliminar todo código do `CognitoService`
2. THE SupabaseAuthService SHALL implementar os seguintes fluxos usando o Supabase Auth Admin API: registro de conta, confirmação de e-mail, login, esqueci senha, reset de senha e convite de contabilidade
3. WHEN um Seller se registra, THE SupabaseAuthService SHALL criar o usuário no Supabase Auth via Admin API e enviar e-mail de confirmação automaticamente gerenciado pelo Supabase
4. WHEN um usuário confirma o e-mail, THE SupabaseAuthService SHALL verificar o token OTP do Supabase e ativar a associação `UserTenant` no banco com status `ACCEPTED`
5. WHEN um usuário realiza login com e-mail e senha válidos, THE SupabaseAuthService SHALL autenticar via Supabase Auth e retornar o `access_token` JWT, `refresh_token` e `expires_in`
6. WHEN um usuário solicita recuperação de senha, THE SupabaseAuthService SHALL acionar o fluxo de reset do Supabase Auth que envia e-mail com link de redefinição, sem revelar se o e-mail existe na base
7. WHEN um Seller convida um contabilista, THE Plataforma SHALL gerar um token de convite único com validade de 48 horas e enviar e-mail via Supabase Auth (magic link ou email personalizado), mantendo o fluxo de `UserTenant` existente no banco
8. IF um Seller tenta registrar com e-mail já existente, THEN THE SupabaseAuthService SHALL retornar erro indicando que o e-mail já está em uso, sem revelar detalhes internos
9. IF um código de confirmação ou reset for inválido ou expirado, THEN THE SupabaseAuthService SHALL retornar erro descritivo indicando o motivo da rejeição
10. THE Plataforma SHALL remover as variáveis de ambiente `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `AWS_REGION` e `AWS_ENDPOINT` do `.env.example` e de todos os módulos de configuração

### Requisito 2: Validação de JWT com Supabase no NestJS

**User Story:** Como desenvolvedor do backend, quero que o JwtAuthGuard valide tokens usando a chave secreta do Supabase, para que a API aceite apenas JWTs emitidos pelo Supabase Auth do projeto.

#### Critérios de Aceite

1. THE JwtAuthGuard SHALL verificar a assinatura do JWT usando `SUPABASE_JWT_SECRET` com algoritmo HS256, substituindo a decodificação sem verificação criptográfica atual
2. THE JwtAuthGuard SHALL extrair do payload JWT os claims `sub` (como `authId`), `email`, e os custom claims `tenantId`, `globalRole` e `tenantRole` para popular o `request.user`
3. THE Plataforma SHALL implementar um Supabase Auth Hook (Database Webhook ou Edge Function) que injeta os custom claims `tenantId`, `globalRole` e `tenantRole` no JWT no momento do login, lendo os dados da tabela `UserTenant`
4. IF o JWT não contiver o claim `tenantId` válido, THEN THE JwtAuthGuard SHALL rejeitar a requisição com resposta 401 Unauthorized
5. IF o JWT estiver expirado ou com assinatura inválida, THEN THE JwtAuthGuard SHALL rejeitar a requisição com resposta 401 Unauthorized sem revelar detalhes da chave utilizada
6. THE Plataforma SHALL adicionar `SUPABASE_JWT_SECRET` e `SUPABASE_SERVICE_ROLE_KEY` como variáveis de ambiente obrigatórias documentadas no `.env.example`

### Requisito 3: Migração do Serviço de Storage

**User Story:** Como desenvolvedor, quero substituir o S3Service pelo SupabaseStorageService, para que o upload e download de notas fiscais use Supabase Storage e o sistema pare de depender do AWS S3.

#### Critérios de Aceite

1. THE Plataforma SHALL remover as dependências `@aws-sdk/client-s3` e `@aws-sdk/s3-request-presigner` do `apps/api/package.json` e eliminar todo código do `S3Service`
2. THE SupabaseStorageService SHALL implementar os seguintes métodos: `generatePresignedUploadUrl(key, contentType, expiresIn)`, `generatePresignedDownloadUrl(key, expiresIn)` e `deleteFile(key)`, usando o cliente `@supabase/supabase-js` com `SUPABASE_SERVICE_ROLE_KEY`
3. WHEN um usuário com papel Seller ou Accounting_Manager solicita upload de nota fiscal, THE SupabaseStorageService SHALL gerar uma Presigned URL para PUT no bucket `invoices` com validade de 15 minutos
4. THE Plataforma SHALL organizar os arquivos no bucket `invoices` seguindo o padrão de path: `notas-fiscais/{tenantId}/{orderId}/{filename}`
5. THE Plataforma SHALL aceitar apenas arquivos com content-type `application/pdf`, `image/png` ou `image/jpeg` e rejeitar arquivos com tamanho superior a 10 MB antes de gerar a Presigned URL
6. THE Plataforma SHALL impor um limite máximo de 10 arquivos de nota fiscal por pedido, rejeitando o upload quando o limite for atingido
7. WHEN um upload é concluído com sucesso pelo cliente usando a Presigned URL, THE Plataforma SHALL registrar um `Invoice` no banco com os campos `storageKey`, `storageUrl`, `filename`, `contentType`, `sizeBytes`, `uploadedAt` e `uploadedById`
8. WHEN um usuário solicita download de nota fiscal, THE SupabaseStorageService SHALL gerar uma Presigned URL para GET no bucket `invoices` com validade de 15 minutos
9. IF a geração de Presigned URL falhar, THEN THE SupabaseStorageService SHALL retornar um erro descritivo e não registrar o `Invoice` no banco
10. THE Plataforma SHALL remover as variáveis de ambiente `S3_BUCKET`, `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` do `.env.example` e de todos os módulos de configuração
11. THE Plataforma SHALL adicionar `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` como variáveis de ambiente obrigatórias para o backend no `.env.example`

### Requisito 4: Migração do Schema Prisma

**User Story:** Como desenvolvedor, quero ajustar o schema Prisma para usar nomenclatura agnóstica de provedor de cloud, para que os modelos de dados não façam referência explícita a serviços AWS.

#### Critérios de Aceite

1. THE Plataforma SHALL renomear o campo `s3Key` para `storageKey` no model `Invoice` do arquivo `packages/db/prisma/schema.prisma`
2. THE Plataforma SHALL adicionar o campo `storageUrl String?` ao model `Invoice` para armazenar a URL pré-assinada em cache ou URL pública do arquivo
3. THE Plataforma SHALL renomear o campo `cognitoSub` para `authId` no model `User` do arquivo `packages/db/prisma/schema.prisma`, mantendo a constraint `@unique`
4. THE Plataforma SHALL criar e aplicar uma migration Prisma que realiza o `RENAME COLUMN` de `cognito_sub` para `auth_id` na tabela `users` e de `s3_key` para `storage_key` na tabela `invoices`, sem perda de dados existentes
5. THE Plataforma SHALL adicionar a coluna `storage_url` como `TEXT NULL` na migration correspondente
6. WHEN a migration for executada, THE Plataforma SHALL preservar todos os dados existentes nas colunas renomeadas sem truncamento ou conversão de tipo
7. THE Plataforma SHALL atualizar todas as referências ao campo `cognitoSub` no código do backend (AuthService, InviteService, seeds) para usar `authId`
8. THE Plataforma SHALL atualizar todas as referências ao campo `s3Key` no código do backend (InvoiceService, InvoicesController) para usar `storageKey`

### Requisito 5: Remoção do SecretsModule e AWS Secrets Manager

**User Story:** Como desenvolvedor, quero remover o SecretsModule e o AWS Secrets Manager, para que a gestão de secrets seja feita exclusivamente por variáveis de ambiente nas plataformas de deploy (Railway e Vercel).

#### Critérios de Aceite

1. THE Plataforma SHALL remover o arquivo `apps/api/src/config/secrets.service.ts` e o `SecretsModule` associado
2. THE Plataforma SHALL remover a dependência `@aws-sdk/client-secrets-manager` do `apps/api/package.json`
3. THE Plataforma SHALL remover as chamadas ao `SecretsService.loadSecrets()` do bootstrap da aplicação (`main.ts` ou `app.module.ts`)
4. THE Plataforma SHALL garantir que todas as variáveis anteriormente gerenciadas pelo Secrets Manager (`DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) sejam carregadas exclusivamente pelo `ConfigModule` do NestJS via `process.env`
5. THE Plataforma SHALL remover as variáveis `AWS_SECRET_NAME`, `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` do `.env.example`
6. THE Plataforma SHALL atualizar o `.env.example` com as novas variáveis de ambiente necessárias para Supabase, Railway e Vercel, incluindo descrição de cada variável

### Requisito 6: Atualização do .env.example

**User Story:** Como desenvolvedor, quero um `.env.example` atualizado que reflita apenas as variáveis necessárias após a migração, para que a configuração do ambiente local seja clara e sem referências a serviços removidos.

#### Critérios de Aceite

1. THE Plataforma SHALL remover do `.env.example` todas as variáveis relacionadas à AWS: `AWS_REGION`, `AWS_ENDPOINT`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SECRET_NAME`, `S3_BUCKET`, `COGNITO_USER_POOL_ID` e `COGNITO_CLIENT_ID`
2. THE Plataforma SHALL adicionar ao `.env.example` as seguintes variáveis obrigatórias com descrição e valor de exemplo: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
3. THE Plataforma SHALL manter no `.env.example` as variáveis existentes não relacionadas à AWS: `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MONTHLY_PRICE_ID`, `STRIPE_SEMIANNUAL_PRICE_ID`, `STRIPE_ANNUAL_PRICE_ID`, `CORS_ORIGIN`, `FRONTEND_URL`, `NEXT_PUBLIC_API_URL`, `NODE_ENV` e `PORT`
4. THE Plataforma SHALL adicionar ao `.env.example` a variável `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` para uso no frontend Next.js
5. THE Plataforma SHALL organizar o `.env.example` em seções comentadas: `# Database`, `# Supabase`, `# Stripe`, `# Frontend`, `# Application`

### Requisito 7: Migração de Infra e Remoção do Terraform

**User Story:** Como desenvolvedor, quero remover a pasta `infra/` com os arquivos Terraform e atualizar o monorepo para refletir o novo modelo de deploy sem infraestrutura como código gerenciada no repositório.

#### Critérios de Aceite

1. THE Plataforma SHALL remover a pasta `infra/` completa do repositório, incluindo todos os arquivos `.tf`, módulos e arquivos de estado locais
2. THE Plataforma SHALL remover referências à pasta `infra/` do `turbo.json`, `.gitignore` e qualquer script de `package.json` que invoque comandos Terraform
3. THE Plataforma SHALL criar um arquivo `DEPLOYMENT.md` na raiz do projeto documentando o processo de deploy no Railway (backend) e Vercel (frontend), incluindo variáveis de ambiente necessárias em cada plataforma
4. THE Plataforma SHALL atualizar o `README.md` principal removendo referências à AWS, Lambda, API Gateway, Amplify e Terraform, e incluindo instruções para Railway e Vercel
5. THE Plataforma SHALL remover o arquivo `apps/api/lambda.ts` (handler para `@codegenie/serverless-express`) e a dependência `@codegenie/serverless-express` do `apps/api/package.json`
6. THE Plataforma SHALL criar ou atualizar o `Dockerfile` de produção em `apps/api/Dockerfile` para deploy no Railway como container NestJS padrão (sem adaptador Lambda)

### Requisito 8: Atualização do Ambiente de Desenvolvimento com Docker

**User Story:** Como desenvolvedor, quero um docker-compose atualizado que remova o LocalStack e use Supabase local via CLI, para que o ambiente de desenvolvimento local seja mais simples e fiel ao ambiente de produção.

#### Critérios de Aceite

1. THE Plataforma SHALL remover o serviço `localstack` do `docker-compose.yml`
2. THE Plataforma SHALL manter o serviço `stripe-cli` no `docker-compose.yml` para forwarding de webhooks Stripe em desenvolvimento
3. THE Plataforma SHALL manter o serviço `postgres` no `docker-compose.yml` para uso local, ou documentar o uso alternativo do Supabase local via CLI (`supabase start`)
4. THE Plataforma SHALL remover do serviço `api` no `docker-compose.yml` as variáveis de ambiente `AWS_ENDPOINT`, `S3_BUCKET` e quaisquer outras variáveis AWS
5. THE Plataforma SHALL adicionar ao serviço `api` no `docker-compose.yml` as variáveis de ambiente `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_JWT_SECRET`, com valores apontando para a instância Supabase local ou via `.env`
6. THE Plataforma SHALL documentar no `README.md` ou em `docs/development.md` os dois modos de desenvolvimento local: (a) PostgreSQL via Docker + Supabase CLI para Auth e Storage, e (b) uso direto do projeto Supabase em staging para desenvolvimento
7. IF um desenvolvedor executar `docker-compose up`, THEN THE Plataforma SHALL iniciar os serviços sem erros relacionados a credenciais AWS ou dependências do LocalStack

### Requisito 9: Atualização do CI/CD — GitHub Actions

**User Story:** Como desenvolvedor, quero atualizar os workflows do GitHub Actions para fazer deploy no Railway e Vercel, para que o pipeline de CI/CD não dependa mais de credenciais AWS ou Terraform.

#### Critérios de Aceite

1. THE Plataforma SHALL remover dos workflows `.github/workflows/deploy.yml` e `.github/workflows/ci.yml` todos os steps que referenciam `aws-actions/configure-aws-credentials`, `secrets.AWS_ACCESS_KEY_ID`, `secrets.AWS_SECRET_ACCESS_KEY` e comandos `terraform`
2. THE Plataforma SHALL adicionar ao workflow `deploy.yml` um job `deploy-api` que realize deploy no Railway usando a Railway CLI ou a action oficial `railway/railway-deploy@v1`, acionado após o job `migrate` ser concluído com sucesso
3. THE Plataforma SHALL adicionar ao workflow `deploy.yml` um job `deploy-web` que realize deploy na Vercel usando a Vercel CLI ou a action oficial `amondnet/vercel-action`, acionado em paralelo ao `deploy-api` após o job `migrate`
4. THE Plataforma SHALL manter no workflow o job `migrate` executando `npx prisma migrate deploy` com a variável `DATABASE_URL` obtida dos secrets do GitHub, antes dos jobs de deploy
5. THE Plataforma SHALL manter os jobs `lint`, `test` e `build` no workflow sem alterações funcionais, apenas removendo dependências de secrets AWS que possam estar referenciadas
6. IF qualquer job do pipeline falhar, THEN THE Plataforma SHALL interromper os jobs dependentes e reportar a falha sem executar o deploy
7. THE Plataforma SHALL documentar no `.github/workflows/README.md` os secrets necessários para o novo pipeline: `RAILWAY_TOKEN`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DATABASE_URL_DEV`, `DATABASE_URL_PROD`

### Requisito 10: Compatibilidade com Fluxos Funcionais Existentes

**User Story:** Como usuário da plataforma, quero que todos os fluxos funcionais continuem funcionando após a migração, para que minha experiência de uso não seja interrompida.

#### Critérios de Aceite

1. WHEN um Seller realiza registro, confirmação de e-mail, login, recuperação e reset de senha, THE Plataforma SHALL executar esses fluxos sem erros, usando Supabase Auth como provedor
2. WHEN um Seller convida um contabilista e o convite é aceito, THE Plataforma SHALL criar e ativar a associação `UserTenant` corretamente, preservando os papéis `ACCOUNTING_MANAGER` e `ACCOUNTING_VIEWER`
3. WHEN um usuário autenticado realiza upload de nota fiscal, THE Plataforma SHALL gerar Presigned URL para o bucket `invoices` no Supabase Storage, aceitar o arquivo via PUT direto do cliente, e registrar o `Invoice` no banco com `storageKey` e `storageUrl` preenchidos
4. WHEN um usuário autenticado solicita download de nota fiscal, THE Plataforma SHALL gerar Presigned URL de GET válida por 15 minutos apontando para o arquivo correto no Supabase Storage
5. THE Plataforma SHALL manter o isolamento multi-tenant: o `TenantGuard` SHALL continuar extraindo `tenantId` exclusivamente do JWT e injetando o filtro nas queries Prisma
6. WHEN um webhook Stripe é recebido, THE Plataforma SHALL continuar validando a assinatura e processando a transição de status de assinatura sem dependência de serviços AWS
7. THE Plataforma SHALL manter a política de senhas existente (mínimo 8 caracteres, maiúscula, minúscula, número e caractere especial) implementada na camada de validação do NestJS, independente do provedor de autenticação
8. IF qualquer fluxo funcional falhar após a migração em ambiente de staging, THEN THE Plataforma SHALL registrar o erro com contexto suficiente para diagnóstico sem expor credenciais Supabase nos logs
