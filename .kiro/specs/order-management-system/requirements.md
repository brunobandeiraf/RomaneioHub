# Requirements Document

## Introduction

Sistema de Gestão de Pedidos com Fornecedores e Notas Fiscais — uma plataforma multi-tenant SaaS que permite a gestores (Sellers) cadastrar fornecedores, produtos e pedidos de compra, anexar notas fiscais, acompanhar gastos em um dashboard analítico e convidar contabilidades com diferentes níveis de acesso. A aplicação utiliza Next.js no frontend, NestJS no backend, Prisma + PostgreSQL como ORM/banco, e infraestrutura AWS com pagamentos via Stripe.

## Glossary

- **Platform**: O sistema completo de gestão de pedidos (frontend + backend + infraestrutura)
- **Tenant**: Uma conta/empresa isolada dentro da plataforma, identificada por um tenant_id
- **Admin**: Conta pré-existente criada via seed com acesso técnico a todos os tenants
- **Seller**: Gestor dono da conta/empresa que gerencia fornecedores, produtos, pedidos e assinatura
- **Accounting_Manager**: Perfil de contabilidade convidado pelo Seller com permissão de cadastro e edição
- **Accounting_Viewer**: Perfil de contabilidade convidado pelo Seller com permissão somente leitura
- **Supplier**: Fornecedor cadastrado em um tenant com razão social, CNPJ e dados de contato
- **Product**: Produto cadastrado com nome, categoria, unidade e preço de referência
- **Order**: Pedido de compra vinculado a um fornecedor contendo itens, valores e notas fiscais
- **Invoice**: Nota fiscal anexada a um pedido, armazenada no S3
- **Subscription**: Assinatura Stripe que controla o acesso ativo ao tenant
- **Grace_Period**: Período de carência após vencimento da assinatura antes de bloqueio total
- **Presigned_URL**: URL pré-assinada do S3 para upload direto de arquivos
- **Audit_Trail**: Registro de quem criou/editou um registro e quando
- **TenantGuard**: Middleware global do NestJS que injeta e valida o tenant_id do token JWT

## Requirements

### Requirement 1: Perfis de Usuário e Controle de Acesso

**User Story:** As a Seller, I want to have distinct user roles with specific permissions, so that I can control who accesses and modifies data in my tenant.

#### Acceptance Criteria

1. THE Platform SHALL support four user roles: Admin, Seller, Accounting_Manager, and Accounting_Viewer
2. THE Platform SHALL grant Admin read-only access to all tenants with MFA authentication required, without permission to create, update, or delete tenant data
3. THE Platform SHALL grant Seller full CRUD access to suppliers, products, orders, invoices, subscription management, and user invitation within the Seller own tenant
4. THE Platform SHALL grant Accounting_Manager CRUD access to suppliers, products, orders, and invoices, and read-only access to dashboard data within the linked tenant, without access to subscription management or user invitation
5. THE Platform SHALL grant Accounting_Viewer read-only access to suppliers, products, orders, invoices, and dashboard data within the linked tenant without access to create, update, or delete operations
6. THE Platform SHALL support a many-to-many relationship between Accounting users and Tenants, allowing one accountant to serve multiple Sellers with independent role assignments per tenant
7. IF a user attempts an action not permitted by their assigned role within a tenant, THEN THE Platform SHALL deny the request and return a 403 Forbidden response without revealing details about the restricted resource

### Requirement 2: Autenticação e Gerenciamento de Conta

**User Story:** As a user, I want secure authentication with email confirmation and password recovery, so that my account remains protected.

#### Acceptance Criteria

1. THE Platform SHALL create the Admin account via a seed script with MFA enabled
2. WHEN a Seller registers, THE Platform SHALL send a confirmation email containing a single-use activation link valid for 24 hours before activating the account
3. WHEN a user requests password recovery, THE Platform SHALL send a 6-digit verification code valid for 15 minutes via email and require a new password conforming to the strong password policy defined in criterion 6
4. WHEN a Seller invites an accountant, THE Platform SHALL send an invitation email containing a single-use link valid for 48 hours that allows the accountant to accept the tenant association with the role specified by the Seller
5. THE Platform SHALL authenticate users via AWS Cognito and issue JWT tokens containing the tenant_id and role claims with an access token expiration of 1 hour and a refresh token expiration of 30 days
6. THE Platform SHALL enforce strong password policy requiring minimum 8 characters, at least one uppercase letter, at least one lowercase letter, at least one number, and at least one special character, with a maximum length of 128 characters
7. IF a Seller attempts to register with an email already associated with an existing account, THEN THE Platform SHALL reject the registration and return an error message indicating the email is already in use
8. IF a password recovery code is invalid or expired, THEN THE Platform SHALL reject the password reset request, return an error message indicating the code is invalid or expired, and allow the user to request a new code
9. IF an invitation link is expired or has already been used, THEN THE Platform SHALL display an error message indicating the link is no longer valid and instruct the user to request a new invitation from the Seller

### Requirement 3: Assinatura e Pagamentos via Stripe

**User Story:** As a Seller, I want to manage my subscription plan, so that I can maintain access to the platform features.

#### Acceptance Criteria

1. WHEN a Seller initiates checkout, THE Platform SHALL redirect to Stripe Checkout for monthly or annual plan selection
2. THE Platform SHALL provide access to Stripe Customer Portal for the Seller to manage payment methods and cancel subscription
3. WHEN a Stripe webhook event is received, THE Platform SHALL validate the webhook signature before processing
4. WHEN a Stripe webhook event is received with a valid signature, THE Platform SHALL map the event to the corresponding subscription status (TRIAL, ACTIVE, PAST_DUE, GRACE_PERIOD, BLOCKED, or CANCELLED) and persist the updated status in the database within 30 seconds of event receipt
5. WHEN a subscription transitions to PAST_DUE status, THE Platform SHALL switch the tenant to read-only mode (blocking all create, update, and delete operations while allowing read and data export) for a Grace_Period of 7 days
6. WHEN the Grace_Period of 7 days elapses without subscription renewal, THE Platform SHALL transition the tenant to BLOCKED status, blocking all operations except authenticated login and read-only data export in CSV format
7. IF webhook signature validation fails, THEN THE Platform SHALL reject the event, return an error response, and not modify the subscription status

### Requirement 4: Cadastro de Fornecedores

**User Story:** As a Seller, I want to register and manage suppliers, so that I can associate them with purchase orders.

#### Acceptance Criteria

1. THE Platform SHALL store Supplier records with the following fields: razão social (required, maximum 255 characters), nome fantasia (optional, maximum 255 characters), CNPJ (required, validated format), contato (optional, maximum 255 characters), and endereço (optional, stored as JSON)
2. WHEN a user attempts to register or edit a Supplier with a CNPJ that already exists within the same tenant, THE Platform SHALL reject the operation and display an error message indicating the CNPJ is already in use
3. WHEN a Supplier has linked orders, THE Platform SHALL prevent physical deletion and allow only inactivation by setting the supplier status to inactive
4. THE Platform SHALL record the creation date, modification date, and responsible user for each Supplier record
5. WHEN a user creates or edits a Supplier, THE Platform SHALL validate that razão social and CNPJ are provided and that the CNPJ follows the valid 14-digit format (XX.XXX.XXX/XXXX-XX) including check-digit verification, rejecting the operation with a field-specific error message if validation fails
6. IF a user attempts to physically delete a Supplier that has no linked orders, THEN THE Platform SHALL permanently remove the Supplier record

### Requirement 5: Cadastro de Produtos

**User Story:** As a Seller, I want to register products and associate them with suppliers at different prices, so that I can track purchasing costs accurately.

#### Acceptance Criteria

1. THE Platform SHALL store Product records with: nome (maximum 200 characters), categoria (maximum 100 characters), unidade (maximum 50 characters), and preço de referência (Decimal 12,2, range 0.01 to 9,999,999,999.99) fields, all required
2. THE Platform SHALL support association of one Product to multiple Suppliers, each with an independent price stored as Decimal 12,2 in the range 0.01 to 9,999,999,999.99
3. WHEN a Product has linked orders, THE Platform SHALL prevent physical deletion, set the product active flag to false, and retain all existing supplier associations and historical data
4. IF a Product has no linked orders, THEN THE Platform SHALL allow physical deletion of the Product record and its supplier associations
5. THE Platform SHALL record the creation date, modification date, and responsible user for each Product record
6. WHEN a user submits a Product creation or edit request, THE Platform SHALL validate that nome, categoria, unidade, and preço de referência are present and within their defined bounds before persisting
7. IF any required Product field is missing or outside its defined bounds, THEN THE Platform SHALL reject the request with an error message indicating which fields failed validation and preserve any previously saved state unchanged

### Requirement 6: Gestão de Pedidos e Compras

**User Story:** As a Seller, I want to create and manage purchase orders with line items and invoices, so that I can track all procurement activity.

#### Acceptance Criteria

1. THE Platform SHALL store Order records with: fornecedor, data, status (enum: DRAFT, CONFIRMED, DELIVERED, CANCELLED), itens (produto, quantidade as Decimal 12,3, preço unitário as Decimal 12,2, subtotal as Decimal 12,2), and valor total (Decimal 12,2) fields
2. THE Platform SHALL calculate each line item subtotal as quantidade × preço unitário, and the order total as the sum of all line item subtotals, recalculating whenever line items are added, modified, or removed
3. THE Platform SHALL require at least 1 and at most 50 line items per Order
4. THE Platform SHALL support one or more Invoice attachments per Order, up to a maximum of 10 files, via Presigned_URL upload
5. WHEN a user creates or edits an Order, THE Platform SHALL record an Audit_Trail entry with the user identity and timestamp
6. WHEN a user requests a status transition, THE Platform SHALL allow only valid transitions: DRAFT→CONFIRMED, CONFIRMED→DELIVERED, DRAFT→CANCELLED, and CONFIRMED→CANCELLED
7. IF a user requests an invalid status transition, THEN THE Platform SHALL reject the request with an error message indicating the current status and the attempted transition
8. WHEN an Invoice file is uploaded, THE Platform SHALL store the file in S3 at path notas-fiscais/{tenant_id}/{pedido_id}/{filename}

### Requirement 7: Upload e Armazenamento de Notas Fiscais

**User Story:** As a Seller, I want to upload invoice files directly to cloud storage, so that documents are securely stored and accessible.

#### Acceptance Criteria

1. WHEN a user with Seller or Accounting_Manager role requests file upload for an Order, THE Platform SHALL generate a Presigned_URL valid for 15 minutes
2. THE Platform SHALL organize uploaded files in S3 following the pattern: notas-fiscais/{tenant_id}/{pedido_id}/{filename}
3. THE Platform SHALL apply S3 Lifecycle rules to transition Invoice files to Glacier Instant Retrieval after 90 days by default, configurable per environment
4. THE Platform SHALL allow Accounting_Viewer to download Invoice files via a Presigned_URL for GET without granting create, edit, or delete permissions on the Invoice record
5. IF an upload fails or the Presigned_URL expires, THEN THE Platform SHALL return an error message indicating the cause of failure and allow the user to request a new Presigned_URL
6. THE Platform SHALL accept only files with content type PDF, PNG, JPG, or JPEG and reject files exceeding 10 MB in size before generating the Presigned_URL
7. WHEN an upload completes successfully, THE Platform SHALL store an Invoice record in the database with filename, s3Key, contentType, sizeBytes, uploadedAt, and uploadedById fields

### Requirement 8: Dashboard Analítico

**User Story:** As a Seller, I want to view aggregated purchase data in a dashboard, so that I can analyze spending patterns and supplier activity.

#### Acceptance Criteria

1. THE Platform SHALL display a period filter at the top of the dashboard supporting: current month, previous month, last 3 months, and custom date range, with current month selected by default
2. IF the user selects a custom date range where the start date is after the end date or the range exceeds 365 days, THEN THE Platform SHALL display a validation error and prevent the query from executing
3. WHEN the user changes the period filter, THE Platform SHALL display a loading indicator and update all dashboard data within 5 seconds without a full page reload
4. THE Platform SHALL display a summary panel with: total amount spent, number of orders, number of distinct suppliers, a monthly evolution line chart showing total amount per month within the selected period, and the top 5 suppliers and top 5 products ranked by total amount spent
5. THE Platform SHALL display a paginated purchases list showing 20 items per page with: date, supplier, products, quantity, amount, status, and invoice download link
6. THE Platform SHALL support filtering the purchases list by supplier, product, and status, with filters applied combinatorially
7. WHEN the user requests CSV export, THE Platform SHALL generate a downloadable CSV file containing all records matching the current filters and period selection
8. IF the selected period contains no order data, THEN THE Platform SHALL display the summary panel with zero values and an empty-state message in the purchases list indicating no records were found
9. WHILE the user role is Accounting_Viewer, THE Platform SHALL hide all create and edit buttons on the dashboard
10. WHILE the user role is Accounting_Manager, THE Platform SHALL display create and edit controls alongside the dashboard data
11. IF the dashboard data request fails due to a network or server error, THEN THE Platform SHALL display an error message and provide a retry option without losing the current filter selections

### Requirement 9: Multi-Tenancy e Isolamento de Dados

**User Story:** As a platform operator, I want complete data isolation between tenants, so that no tenant can access another tenant data.

#### Acceptance Criteria

1. THE Platform SHALL include a tenant_id column in all tenant-scoped database tables (Supplier, Product, Order, AuditLog)
2. THE Platform SHALL extract tenant_id exclusively from the authenticated JWT token, never from the request body or query parameters
3. THE Platform SHALL apply a global TenantGuard that automatically injects tenant_id filter on all Prisma findMany, findFirst, create, update, and delete operations for tenant-scoped models via Prisma Middleware
4. IF a request attempts to access a resource belonging to a different tenant, THEN THE Platform SHALL return a 403 Forbidden response with a generic error message that does not reveal whether the resource exists
5. THE Platform SHALL ensure that Prisma queries never use $queryRawUnsafe with user-provided input
6. IF the JWT token does not contain a valid tenant_id claim, THEN THE Platform SHALL reject the request with a 401 Unauthorized response
7. WHEN the authenticated user has Admin role, THE Platform SHALL bypass the TenantGuard tenant_id filter to allow cross-tenant read access

### Requirement 10: Segurança da Aplicação

**User Story:** As a platform operator, I want comprehensive security controls, so that the application is protected against common attack vectors.

#### Acceptance Criteria

1. IF incoming request data fails class-validator DTO validation in NestJS, THEN THE Platform SHALL reject the request with a 400 Bad Request response containing the list of validation constraint violations without exposing internal system details
2. THE Platform SHALL enforce rate limiting via @nestjs/throttler configured with a maximum of 100 requests per 60-second window per IP, and API Gateway throttling as a secondary layer
3. THE Platform SHALL configure CORS policies allowing only the production Next.js frontend domain (set via environment variable) as the permitted origin, rejecting requests from all other origins
4. THE Platform SHALL store sensitive credentials (DATABASE_URL, Stripe keys) in AWS Secrets Manager, never in source code
5. THE Platform SHALL use parameterized Prisma queries for all database operations, prohibiting the use of $queryRawUnsafe with user-provided input
6. WHEN a Stripe webhook is received, THE Platform SHALL validate the Stripe signature using the STRIPE_WEBHOOK_SECRET before processing the event payload
7. IF Stripe webhook signature validation fails, THEN THE Platform SHALL reject the webhook request with a 401 Unauthorized response and discard the event payload without processing
8. THE Platform SHALL enforce MFA for the Admin account via AWS Cognito, blocking any Admin authentication attempt that does not complete the MFA challenge

### Requirement 11: Trilha de Auditoria

**User Story:** As a Seller, I want to know who created or modified each record and when, so that I can maintain accountability.

#### Acceptance Criteria

1. THE Platform SHALL store created_at, updated_at, created_by_id, and updated_by_id fields for every Supplier, Product, and Order record
2. WHEN a record is created, THE Platform SHALL set created_at to the current timestamp, updated_at to the current timestamp, and both created_by_id and updated_by_id to the authenticated user ID
3. WHEN a record is modified, THE Platform SHALL update updated_at to the current timestamp and updated_by_id to the authenticated user ID, preserving the original created_at and created_by_id values
4. WHEN a record is created, updated, or soft-deleted, THE Platform SHALL write an entry to the AuditLog table containing: tenantId, userId, action (CREATE, UPDATE, or DELETE), entityType, entityId, changes (JSON diff of modified fields), and createdAt timestamp
5. THE Platform SHALL make Audit_Trail data (both entity fields and AuditLog entries) visible as read-only to Seller, Accounting_Manager, and Accounting_Viewer roles
6. THE Platform SHALL ensure AuditLog records are immutable — once written, they cannot be modified or deleted by any user role

### Requirement 12: Infraestrutura e Deploy

**User Story:** As a platform operator, I want automated infrastructure provisioning and deployment, so that environments are consistent and reproducible.

#### Acceptance Criteria

1. THE Platform SHALL deploy NestJS backend via AWS Lambda using @codegenie/serverless-express, bundled with esbuild, behind API Gateway
2. THE Platform SHALL deploy Next.js frontend via AWS Amplify Hosting or OpenNext
3. THE Platform SHALL provision PostgreSQL on RDS (db.t4g.micro, single-AZ) with connection pooling via RDS Proxy or Prisma Accelerate
4. THE Platform SHALL manage infrastructure as code using Terraform or AWS CDK with separate environments for dev, staging, and prod, each with an independent state file and variable set
5. WHEN code is pushed to the main branch or a release tag is created, THE Platform SHALL trigger the CI/CD pipeline executing stages in order: lint, tests, build, prisma migrate deploy, and infrastructure deploy
6. IF any CI/CD pipeline stage fails, THEN THE Platform SHALL halt the pipeline, prevent subsequent stages from executing, and report the failure to the operator
7. IF a database migration fails during the prisma migrate deploy stage, THEN THE Platform SHALL abort the deployment without proceeding to infrastructure deploy and report the migration error to the operator
8. THE Platform SHALL use a monorepo structure managed by Turborepo with apps/web (Next.js), apps/api (NestJS), and packages/db (shared Prisma schema)

### Requirement 13: Ambiente de Desenvolvimento com Docker

**User Story:** As a developer, I want a complete local development environment using Docker, so that I can test all services locally without depending on cloud infrastructure.

#### Acceptance Criteria

1. THE Platform SHALL provide a docker-compose configuration that runs PostgreSQL 16 Alpine, LocalStack (S3 emulation on port 4566), Stripe CLI (forwarding webhooks to local API), NestJS API (with hot-reload), and Next.js web (with hot-reload) services
2. WHEN a developer runs docker-compose up, THE Platform SHALL start services in dependency order (PostgreSQL → LocalStack → API → Web) using health checks to ensure dependent services are ready before starting dependents
3. WHEN the API service starts in development mode, THE Platform SHALL automatically run Prisma migrations and seed script to provision the database with schema and test data
4. THE Platform SHALL configure the Stripe CLI service to forward webhook events to http://api:3001/subscriptions/webhook for local payment testing
5. THE Platform SHALL use a named Docker volume for PostgreSQL data persistence across container restarts
6. THE Platform SHALL allow all integration tests to run against the Docker-based local environment by exposing PostgreSQL on port 5432 and LocalStack on port 4566 to the host machine
7. THE Platform SHALL document all environment variables required for local development in a .env.example file with descriptions and example values for each variable

### Requirement 14: Cancelamento e Retenção de Dados

**User Story:** As a Seller, I want my data to be preserved temporarily after cancellation, so that I can recover my account if I change my mind.

#### Acceptance Criteria

1. WHEN a Seller cancels the subscription, THE Platform SHALL retain all tenant data in read-only mode during the Grace_Period of 30 days
2. WHILE the tenant is in Grace_Period, THE Platform SHALL allow the Seller to view and export data in CSV format without creating or editing records
3. WHEN the Grace_Period of 30 days elapses without subscription renewal, THE Platform SHALL transition the tenant to BLOCKED status and schedule data anonymization or deletion according to the retention policy
4. THE Platform SHALL notify the Seller via email at subscription cancellation, 7 days before Grace_Period expiration, and at Grace_Period expiration
5. IF a Seller renews the subscription during the Grace_Period, THEN THE Platform SHALL restore full write access to the tenant within 5 minutes and transition the status back to ACTIVE
