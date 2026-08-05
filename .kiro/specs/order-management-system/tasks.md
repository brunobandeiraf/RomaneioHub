# Implementation Plan: Order Management System

## Overview

Implement a multi-tenant SaaS platform (ComprasHub) for managing purchase orders, suppliers, products, and invoices. The system uses a Turborepo monorepo with Next.js frontend, NestJS backend (Lambda), Prisma + PostgreSQL, and AWS infrastructure. Implementation follows an incremental approach: project scaffolding → shared packages → backend guards & middleware → feature modules → frontend pages → infrastructure.

## Tasks

- [x] 1. Set up monorepo structure and shared packages
  - [x] 1.1 Initialize Turborepo monorepo with apps/web, apps/api, and packages/db, packages/shared
    - Create root package.json with Turborepo config and workspaces
    - Create turbo.json with pipeline definitions for build, lint, test, dev
    - Set up apps/web as Next.js App Router project with Tailwind CSS
    - Set up apps/api as NestJS project with esbuild bundling
    - Create packages/db with Prisma schema and seed script placeholder
    - Create packages/shared with shared types, constants, and validators
    - _Requirements: 12.8_

  - [x] 1.2 Define Prisma schema with all models, enums, and relations
    - Implement the full schema.prisma with Tenant, User, UserTenant, Supplier, Product, ProductSupplier, Order, OrderItem, Invoice, AuditLog models
    - Define all enums: GlobalRole, TenantRole, InviteStatus, SubscriptionStatus, OrderStatus
    - Add all indexes and unique constraints (tenantId+cnpj, userId+tenantId, etc.)
    - _Requirements: 4.1, 5.1, 6.1, 9.1, 11.1_

  - [x] 1.3 Create initial Prisma migration and seed script
    - Generate initial migration from schema
    - Implement seed.ts with Admin user creation (MFA enabled), sample tenant, and test data
    - _Requirements: 2.1, 12.5_

  - [x] 1.4 Set up shared types and validators in packages/shared
    - Define TypeScript interfaces/types for all entities matching Prisma models
    - Implement CNPJ validation function with check-digit verification
    - Implement password strength validation (min 8, uppercase, lowercase, number, special char, max 128)
    - Define shared constants (max file size, allowed content types, status transitions)
    - _Requirements: 2.6, 4.5, 6.6_

- [x] 2. Implement backend core infrastructure (guards, middleware, filters)
  - [x] 2.1 Implement PrismaService and tenant-scoped middleware
    - Create PrismaService extending PrismaClient with onModuleInit/onModuleDestroy
    - Implement Prisma middleware for automatic tenant_id injection on findMany, findFirst, create, update, delete
    - Use AsyncLocalStorage (CLS) to propagate tenantId from request context to Prisma middleware
    - _Requirements: 9.3, 9.5_

  - [x] 2.2 Implement TenantGuard for JWT tenant extraction
    - Extract tenant_id from JWT claims, set on request context
    - Return 401 if JWT missing valid tenant_id claim
    - Bypass tenant filter for Admin role (cross-tenant read)
    - _Requirements: 9.2, 9.6, 9.7_

  - [x] 2.3 Implement RolesGuard with @Roles() decorator
    - Create @Roles() decorator to specify allowed roles per endpoint
    - Implement RolesGuard that checks user's TenantRole against required roles
    - Return 403 Forbidden without revealing resource details on unauthorized access
    - _Requirements: 1.7_

  - [x] 2.4 Implement SubscriptionGuard for write-blocking
    - Block POST/PATCH/PUT/DELETE when subscription status is PAST_DUE, GRACE_PERIOD, or BLOCKED
    - Allow all read (GET) operations for non-BLOCKED statuses
    - Block all operations (except login and CSV export) when BLOCKED
    - _Requirements: 3.5, 3.6, 14.2_

  - [x] 2.5 Implement global exception filter and DTO validation pipe
    - Configure ValidationPipe globally with class-validator and class-transformer
    - Create HttpExceptionFilter that formats errors without exposing internals
    - Return 400 with validation constraint list on DTO failures
    - _Requirements: 10.1_

  - [x] 2.6 Implement AuditInterceptor for automatic audit trail
    - Create interceptor that writes AuditLog entries on create/update/delete operations
    - Capture userId, tenantId, action, entityType, entityId, and JSON diff of changes
    - Ensure AuditLog records are immutable (no update/delete endpoints)
    - _Requirements: 11.2, 11.3, 11.4, 11.6_

  - [ ]* 2.7 Write property test for tenant data isolation (Property 2)
    - **Property 2: Tenant Data Isolation**
    - For any query executed by user U belonging to tenant T, no records from tenant T' (where T ≠ T') are returned
    - **Validates: Requirements 9.3, 9.4**

  - [ ]* 2.8 Write property test for role-based write access enforcement (Property 6)
    - **Property 6: Role-Based Write Access Enforcement**
    - For any user with Accounting_Viewer role, all POST/PATCH/PUT/DELETE requests to CRUD endpoints return 403 Forbidden
    - **Validates: Requirements 1.5**

  - [ ]* 2.9 Write property test for subscription guard write block (Property 9)
    - **Property 9: Subscription Guard Write Block**
    - While a tenant's subscription status is GRACE_PERIOD or BLOCKED, all write operations return an error response, but read operations succeed
    - **Validates: Requirements 3.5, 14.2**

- [x] 3. Implement authentication module
  - [x] 3.1 Implement auth module with AWS Cognito integration
    - Create AuthModule with CognitoService wrapping AWS SDK Cognito Identity Provider
    - Implement register endpoint: create Cognito user + send confirmation email with 24h activation link
    - Implement confirm endpoint: verify activation link and activate account
    - Implement login endpoint: authenticate and return JWT (access 1h, refresh 30d) with tenant_id and role claims
    - _Requirements: 2.2, 2.5_

  - [x] 3.2 Implement password recovery flow
    - Implement forgot-password endpoint: send 6-digit code valid for 15 minutes
    - Implement reset-password endpoint: validate code and enforce strong password policy
    - Return appropriate error for invalid/expired codes
    - _Requirements: 2.3, 2.8_

  - [x] 3.3 Implement invitation flow for accountants
    - Implement invite endpoint: Seller sends invitation with role (Accounting_Manager or Accounting_Viewer)
    - Send email with single-use link valid for 48 hours
    - Implement accept-invite endpoint: create UserTenant association with specified role
    - Support many-to-many relationship (one accountant → multiple tenants)
    - Return error for expired/used invitation links
    - _Requirements: 2.4, 1.6, 2.9_

  - [ ]* 3.4 Write unit tests for auth module
    - Test registration with duplicate email (requirement 2.7)
    - Test password validation against policy
    - Test invitation link expiration handling
    - _Requirements: 2.6, 2.7, 2.8, 2.9_

- [x] 4. Implement suppliers module
  - [x] 4.1 Implement suppliers CRUD endpoints
    - Create SuppliersModule with controller, service, and DTOs
    - Implement GET /suppliers (list with pagination), GET /suppliers/:id
    - Implement POST /suppliers with CNPJ validation (14-digit format + check-digit)
    - Implement PATCH /suppliers/:id with CNPJ uniqueness check per tenant
    - Implement DELETE /suppliers/:id (soft-delete if orders exist, hard-delete otherwise)
    - Record audit trail fields (createdAt, updatedAt, createdById, updatedById)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 4.2 Write property test for CNPJ uniqueness per tenant (Property 3)
    - **Property 3: CNPJ Uniqueness Per Tenant**
    - For any tenant, no two active suppliers share the same CNPJ; different tenants may have suppliers with the same CNPJ
    - **Validates: Requirements 4.2**

  - [ ]* 4.3 Write property test for soft delete integrity (Property 4)
    - **Property 4: Soft Delete Integrity**
    - For any supplier or product with at least one linked order, a delete operation results in inactivation (active=false) and never physical removal
    - **Validates: Requirements 4.3, 5.3**

- [x] 5. Implement products module
  - [x] 5.1 Implement products CRUD endpoints
    - Create ProductsModule with controller, service, and DTOs
    - Implement GET /products (list with pagination), GET /products/:id
    - Implement POST /products with validation (nome ≤200, categoria ≤100, unidade ≤50, precoReferencia in 0.01–9999999999.99)
    - Implement PATCH /products/:id
    - Implement DELETE /products/:id (soft-delete if orders exist, hard-delete otherwise)
    - Record audit trail fields
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 5.2 Implement product-supplier association endpoints
    - Implement POST /products/:id/suppliers (associate supplier with price)
    - Implement PATCH /products/:id/suppliers/:supplierId (update price)
    - Implement DELETE /products/:id/suppliers/:supplierId (remove association)
    - Validate price range Decimal(12,2) 0.01–9999999999.99
    - _Requirements: 5.2_

  - [ ]* 5.3 Write unit tests for products module
    - Test field validation boundaries
    - Test soft-delete vs hard-delete logic
    - Test product-supplier price association
    - _Requirements: 5.6, 5.7_

- [x] 6. Checkpoint - Core entities
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement orders module
  - [x] 7.1 Implement order CRUD endpoints
    - Create OrdersModule with controller, service, and DTOs
    - Implement GET /orders (list with pagination and filters), GET /orders/:id (with items and invoices)
    - Implement POST /orders with at least 1, at most 50 line items
    - Implement PATCH /orders/:id for order data
    - Automatically calculate subtotal (quantidade × precoUnit) and order total (sum of subtotals) on create/update
    - Record audit trail fields and AuditLog entry
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [x] 7.2 Implement order items management
    - Implement POST /orders/:id/items (add item, recalculate total)
    - Implement PATCH /orders/:id/items/:itemId (update item, recalculate total)
    - Implement DELETE /orders/:id/items/:itemId (remove item, recalculate total)
    - Enforce 1–50 items constraint on every mutation
    - _Requirements: 6.2, 6.3_

  - [x] 7.3 Implement order status state machine
    - Implement PATCH /orders/:id/status endpoint
    - Enforce valid transitions: DRAFT→CONFIRMED, CONFIRMED→DELIVERED, DRAFT→CANCELLED, CONFIRMED→CANCELLED
    - Return error with current status and attempted transition on invalid transitions
    - _Requirements: 6.6, 6.7_

  - [ ]* 7.4 Write property test for order total calculation integrity (Property 1)
    - **Property 1: Order Total Calculation Integrity**
    - For all valid orders, the order total equals the sum of (quantidade × precoUnit) for each item
    - **Validates: Requirements 6.2**

  - [ ]* 7.5 Write property test for audit trail completeness (Property 7)
    - **Property 7: Audit Trail Completeness**
    - For any create or update on Supplier, Product, or Order, the resulting record has non-null created_at, updated_at, and responsible_user_id where updated_at >= created_at
    - **Validates: Requirements 11.1, 11.2, 11.3**

- [ ] 8. Implement invoices module
  - [ ] 8.1 Implement invoice upload and storage endpoints
    - Create InvoicesModule with controller, service, and S3Service
    - Implement POST /orders/:id/invoices/upload-url: validate content type (PDF, PNG, JPG, JPEG) and size (≤10MB), generate presigned URL valid for 15 minutes at path notas-fiscais/{tenant_id}/{pedido_id}/{filename}
    - Implement POST /orders/:id/invoices: register Invoice record after successful upload (filename, s3Key, contentType, sizeBytes, uploadedAt, uploadedById)
    - Implement GET /orders/:id/invoices: list invoices for order
    - Implement GET /orders/:id/invoices/:invoiceId/download: generate presigned GET URL
    - Enforce max 10 invoices per order
    - _Requirements: 6.4, 7.1, 7.2, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 8.2 Write property test for presigned URL security (Property 8)
    - **Property 8: Presigned URL Security**
    - For any generated presigned URL, the S3 key follows the pattern notas-fiscais/{tenant_id}/{pedido_id}/{filename} where tenant_id matches the requesting user's tenant
    - **Validates: Requirements 7.1, 7.2**

- [ ] 9. Implement subscriptions module
  - [ ] 9.1 Implement Stripe checkout and portal endpoints
    - Create SubscriptionsModule with controller, service, and StripeService
    - Implement POST /subscriptions/checkout: create Stripe Checkout session (monthly/annual)
    - Implement GET /subscriptions/portal: generate Stripe Customer Portal URL
    - Implement GET /subscriptions/status: return current subscription status
    - _Requirements: 3.1, 3.2_

  - [ ] 9.2 Implement Stripe webhook handler with signature validation
    - Implement POST /subscriptions/webhook: validate Stripe signature before processing
    - Map webhook events to subscription status transitions (TRIAL, ACTIVE, PAST_DUE, GRACE_PERIOD, BLOCKED, CANCELLED)
    - Persist status within 30 seconds of event receipt
    - Return 401 on signature validation failure without processing event
    - Implement Grace_Period logic (7 days read-only after PAST_DUE)
    - _Requirements: 3.3, 3.4, 3.7, 10.6, 10.7_

  - [ ] 9.3 Implement cancellation and data retention flow
    - Transition to read-only mode on cancellation with 30-day Grace_Period
    - Allow view and CSV export during Grace_Period
    - Schedule data anonymization/deletion after Grace_Period expires
    - Send notification emails at cancellation, 7 days before expiration, and at expiration
    - Restore full access within 5 minutes on renewal during Grace_Period
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ]* 9.4 Write property test for subscription state machine consistency (Property 5)
    - **Property 5: Subscription State Machine Consistency**
    - Subscription status transitions follow valid paths: TRIAL→ACTIVE, ACTIVE→PAST_DUE, PAST_DUE→GRACE_PERIOD, GRACE_PERIOD→BLOCKED, any→CANCELLED, GRACE_PERIOD→ACTIVE
    - **Validates: Requirements 3.4, 3.5, 3.6**

- [ ] 10. Checkpoint - Backend feature modules
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Implement dashboard module
  - [ ] 11.1 Implement dashboard summary and purchases endpoints
    - Create DashboardModule with controller and service
    - Implement GET /dashboard/summary: total amount, order count, distinct suppliers, monthly evolution, top 5 suppliers, top 5 products for selected period
    - Implement GET /dashboard/purchases: paginated list (20/page) with date, supplier, products, quantity, amount, status, invoice link
    - Support period filters: current month, previous month, last 3 months, custom range
    - Validate custom range (start ≤ end, max 365 days)
    - Support filtering by supplier, product, status (combinatorial)
    - _Requirements: 8.1, 8.2, 8.4, 8.5, 8.6_

  - [ ] 11.2 Implement CSV export endpoint
    - Implement GET /dashboard/export: generate CSV with all records matching filters and period
    - Ensure export works during GRACE_PERIOD and BLOCKED statuses
    - _Requirements: 8.7, 14.2_

  - [ ]* 11.3 Write property test for dashboard data consistency (Property 10)
    - **Property 10: Dashboard Data Consistency**
    - The total amount spent reported by the dashboard equals the sum of all order totals within the selected date range for the tenant
    - **Validates: Requirements 8.4**

- [ ] 12. Implement security configuration
  - [ ] 12.1 Configure rate limiting and CORS
    - Set up @nestjs/throttler with 100 requests per 60-second window per IP
    - Configure CORS to allow only the production frontend domain (from env variable)
    - Configure API Gateway throttling as secondary layer
    - _Requirements: 10.2, 10.3_

  - [ ] 12.2 Configure secrets management and MFA enforcement
    - Integrate AWS Secrets Manager for DATABASE_URL, Stripe keys, and other credentials
    - Enforce MFA for Admin account via Cognito configuration
    - Ensure no secrets in source code
    - _Requirements: 10.4, 10.8, 2.1_

- [ ] 13. Implement frontend pages
  - [ ] 13.1 Implement authentication pages
    - Create /login page with email/password form
    - Create /register page for Seller registration
    - Implement password recovery flow pages (forgot-password, reset-password)
    - Set up API client with JWT token management (access + refresh)
    - Integrate with TanStack Query for server state
    - _Requirements: 2.2, 2.3, 2.5_

  - [ ] 13.2 Implement suppliers pages
    - Create /suppliers page with paginated list, search, and filters
    - Create /suppliers/[id] page for detail/edit
    - Implement create supplier form with CNPJ validation and mask
    - Handle soft-delete vs hard-delete confirmation
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_

  - [ ] 13.3 Implement products pages
    - Create /products page with paginated list, search, and filters
    - Create /products/[id] page for detail/edit with supplier price associations
    - Implement create/edit forms with field validation
    - Handle soft-delete vs hard-delete confirmation
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [ ] 13.4 Implement orders pages
    - Create /orders page with paginated list and filters (status, supplier, date)
    - Create /orders/[id] page with order details, line items, and invoice attachments
    - Create /orders/new page with dynamic line items (1–50), auto-calculated totals
    - Implement status transition buttons with valid transition enforcement
    - Implement invoice upload via presigned URL with file type/size validation
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6, 7.1, 7.6_

  - [ ] 13.5 Implement dashboard page
    - Create /dashboard page with period filter (current month, previous, last 3, custom range)
    - Implement summary panel with metrics, monthly evolution chart, top 5 lists
    - Implement paginated purchases list (20/page) with combined filters
    - Implement CSV export button
    - Handle empty state and loading indicators
    - Enforce role-based UI (hide create/edit for Accounting_Viewer, show for Accounting_Manager)
    - Handle error state with retry option preserving filter selections
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11_

  - [ ] 13.6 Implement settings pages (subscription and team management)
    - Create /settings/subscription page with Stripe Checkout redirect and Customer Portal link
    - Display current subscription status and Grace_Period information
    - Create /settings/team page for inviting accountants and managing existing associations
    - _Requirements: 3.1, 3.2, 1.6, 2.4_

- [ ] 14. Checkpoint - Frontend implementation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Set up Docker development environment
  - [ ] 15.1 Create docker-compose configuration
    - Configure PostgreSQL 16 Alpine with named volume for data persistence
    - Configure LocalStack for S3 emulation on port 4566
    - Configure Stripe CLI forwarding webhooks to http://api:3001/subscriptions/webhook
    - Configure API service with hot-reload and depends_on with health checks
    - Configure Web service with hot-reload and dependency on API
    - Ensure services start in correct order: PostgreSQL → LocalStack → API → Web
    - Expose PostgreSQL on 5432 and LocalStack on 4566 to host
    - _Requirements: 13.1, 13.2, 13.4, 13.5, 13.6_

  - [ ] 15.2 Create .env.example and Dockerfiles for dev
    - Create .env.example with all required env variables, descriptions, and example values
    - Create apps/api/Dockerfile.dev for NestJS with hot-reload
    - Create apps/web/Dockerfile.dev for Next.js with hot-reload
    - Configure API to auto-run Prisma migrations and seed on startup in dev mode
    - _Requirements: 13.3, 13.7_

- [ ] 16. Set up infrastructure as code
  - [ ] 16.1 Create Terraform/CDK infrastructure modules
    - Define Lambda function for NestJS backend with @codegenie/serverless-express
    - Define API Gateway with rate limiting and WAF rules
    - Define RDS PostgreSQL (db.t4g.micro, single-AZ) with RDS Proxy
    - Define S3 bucket with Lifecycle rules (Glacier Instant Retrieval after 90 days)
    - Define Cognito User Pool with password policy and MFA
    - Define Amplify Hosting for Next.js frontend
    - Configure separate environments (dev, staging, prod) with independent state/variables
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 7.3_

  - [ ] 16.2 Create CI/CD pipeline configuration
    - Configure pipeline triggered on main branch push or release tag
    - Implement stages in order: lint → tests → build → prisma migrate deploy → infrastructure deploy
    - Halt pipeline and report failure on any stage failure
    - Handle migration failure specifically (abort without proceeding to infra deploy)
    - _Requirements: 12.5, 12.6, 12.7_

- [ ] 17. Final checkpoint - Complete integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at meaningful integration points
- Property tests validate universal correctness properties from the design document
- The implementation language is TypeScript throughout (NestJS + Next.js + Prisma)
- Backend guards are implemented early as they are cross-cutting concerns used by all feature modules
- Frontend tasks come after backend to ensure APIs are available for integration

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.4"] },
    { "id": 2, "tasks": ["1.3"] },
    { "id": 3, "tasks": ["2.1", "2.5"] },
    { "id": 4, "tasks": ["2.2", "2.3", "2.4", "2.6"] },
    { "id": 5, "tasks": ["2.7", "2.8", "2.9", "3.1"] },
    { "id": 6, "tasks": ["3.2", "3.3", "3.4"] },
    { "id": 7, "tasks": ["4.1", "5.1"] },
    { "id": 8, "tasks": ["4.2", "4.3", "5.2", "5.3"] },
    { "id": 9, "tasks": ["7.1"] },
    { "id": 10, "tasks": ["7.2", "7.3"] },
    { "id": 11, "tasks": ["7.4", "7.5", "8.1"] },
    { "id": 12, "tasks": ["8.2", "9.1"] },
    { "id": 13, "tasks": ["9.2", "9.3"] },
    { "id": 14, "tasks": ["9.4", "11.1"] },
    { "id": 15, "tasks": ["11.2", "11.3", "12.1", "12.2"] },
    { "id": 16, "tasks": ["13.1"] },
    { "id": 17, "tasks": ["13.2", "13.3"] },
    { "id": 18, "tasks": ["13.4", "13.5", "13.6"] },
    { "id": 19, "tasks": ["15.1", "16.1"] },
    { "id": 20, "tasks": ["15.2", "16.2"] }
  ]
}
```
