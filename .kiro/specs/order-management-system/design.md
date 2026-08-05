# Design Document

## Overview

Este documento descreve a arquitetura técnica e o plano de implementação do Sistema de Gestão de Pedidos com Fornecedores e Notas Fiscais. A plataforma é construída como um monorepo multi-tenant SaaS com Next.js (frontend), NestJS (backend), Prisma + PostgreSQL (dados), e infraestrutura AWS.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AWS CloudFront (CDN)                         │
└──────────────────────────────────┬──────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
         ┌──────────▼──────────┐      ┌──────────▼──────────┐
         │   Next.js Frontend   │      │   NestJS API (Lambda) │
         │   (Amplify Hosting)  │      │   via API Gateway     │
         └──────────────────────┘      └──────────┬──────────┘
                                                   │
                    ┌──────────────────────────────┼──────────────┐
                    │                              │              │
         ┌──────────▼──────────┐      ┌───────────▼───┐   ┌─────▼─────┐
         │   AWS Cognito        │      │  PostgreSQL   │   │  AWS S3   │
         │   (Auth + JWT)       │      │  (RDS)        │   │  (Invoices)│
         └──────────────────────┘      └───────────────┘   └───────────┘
                                                │
                                       ┌────────▼────────┐
                                       │  RDS Proxy /    │
                                       │  Prisma Accel.  │
                                       └─────────────────┘
```

### Monorepo Structure

```
compras-hub/
├── apps/
│   ├── web/                    # Next.js App Router + Tailwind CSS
│   │   ├── src/
│   │   │   ├── app/            # App Router pages
│   │   │   ├── components/     # UI components
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── lib/            # Utilities & API client
│   │   │   └── types/          # TypeScript types
│   │   ├── next.config.ts
│   │   └── tailwind.config.ts
│   └── api/                    # NestJS backend
│       ├── src/
│       │   ├── modules/        # Feature modules
│       │   │   ├── auth/
│       │   │   ├── tenants/
│       │   │   ├── suppliers/
│       │   │   ├── products/
│       │   │   ├── orders/
│       │   │   ├── invoices/
│       │   │   ├── subscriptions/
│       │   │   └── dashboard/
│       │   ├── common/         # Guards, interceptors, filters
│       │   │   ├── guards/
│       │   │   │   ├── tenant.guard.ts
│       │   │   │   ├── roles.guard.ts
│       │   │   │   └── subscription.guard.ts
│       │   │   ├── interceptors/
│       │   │   ├── filters/
│       │   │   └── decorators/
│       │   ├── prisma/         # Prisma service & middleware
│       │   └── main.ts
│       ├── test/               # E2E tests
│       └── lambda.ts           # Lambda handler entry
├── packages/
│   ├── db/                     # Shared Prisma schema
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   └── package.json
│   └── shared/                 # Shared types & utilities
│       ├── src/
│       │   ├── types/
│       │   ├── constants/
│       │   └── validators/
│       └── package.json
├── infra/                      # Terraform / CDK
│   ├── modules/
│   ├── environments/
│   │   ├── dev/
│   │   ├── staging/
│   │   └── prod/
│   └── main.tf
├── docker-compose.yml          # Local development environment
├── docker-compose.override.yml # Local overrides
├── .env.example
├── turbo.json
└── package.json
```

## Database Schema

### Entity Relationship Model

```prisma
// packages/db/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id                String          @id @default(uuid())
  name              String
  stripeCustomerId  String?         @unique
  subscriptionStatus SubscriptionStatus @default(TRIAL)
  gracePeriodEnd    DateTime?
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  users             UserTenant[]
  suppliers         Supplier[]
  products          Product[]
  orders            Order[]
}

model User {
  id              String        @id @default(uuid())
  cognitoSub      String        @unique
  email           String        @unique
  name            String
  globalRole      GlobalRole    @default(SELLER)
  mfaEnabled      Boolean       @default(false)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  tenants         UserTenant[]
  auditRecords    AuditLog[]
}

model UserTenant {
  id        String      @id @default(uuid())
  userId    String
  tenantId  String
  role      TenantRole
  status    InviteStatus @default(PENDING)
  invitedAt DateTime    @default(now())
  acceptedAt DateTime?

  user      User        @relation(fields: [userId], references: [id])
  tenant    Tenant      @relation(fields: [tenantId], references: [id])

  @@unique([userId, tenantId])
  @@index([tenantId])
}

model Supplier {
  id            String    @id @default(uuid())
  tenantId      String
  razaoSocial   String
  nomeFantasia  String?
  cnpj          String
  contato       String?
  endereco      Json?
  active        Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  createdById   String
  updatedById   String

  tenant        Tenant    @relation(fields: [tenantId], references: [id])
  orders        Order[]
  productSuppliers ProductSupplier[]

  @@unique([tenantId, cnpj])
  @@index([tenantId])
}

model Product {
  id              String    @id @default(uuid())
  tenantId        String
  nome            String
  categoria       String
  unidade         String
  precoReferencia Decimal   @db.Decimal(12, 2)
  active          Boolean   @default(true)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  createdById     String
  updatedById     String

  tenant          Tenant    @relation(fields: [tenantId], references: [id])
  suppliers       ProductSupplier[]
  orderItems      OrderItem[]

  @@index([tenantId])
}

model ProductSupplier {
  id          String    @id @default(uuid())
  productId   String
  supplierId  String
  price       Decimal   @db.Decimal(12, 2)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  product     Product   @relation(fields: [productId], references: [id])
  supplier    Supplier  @relation(fields: [supplierId], references: [id])

  @@unique([productId, supplierId])
}

model Order {
  id          String      @id @default(uuid())
  tenantId    String
  supplierId  String
  date        DateTime
  status      OrderStatus @default(DRAFT)
  total       Decimal     @db.Decimal(12, 2) @default(0)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  createdById String
  updatedById String

  tenant      Tenant      @relation(fields: [tenantId], references: [id])
  supplier    Supplier    @relation(fields: [supplierId], references: [id])
  items       OrderItem[]
  invoices    Invoice[]

  @@index([tenantId])
  @@index([tenantId, supplierId])
  @@index([tenantId, date])
}

model OrderItem {
  id          String    @id @default(uuid())
  orderId     String
  productId   String
  quantidade  Decimal   @db.Decimal(12, 3)
  precoUnit   Decimal   @db.Decimal(12, 2)
  subtotal    Decimal   @db.Decimal(12, 2)

  order       Order     @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product     Product   @relation(fields: [productId], references: [id])

  @@index([orderId])
}

model Invoice {
  id          String    @id @default(uuid())
  orderId     String
  filename    String
  s3Key       String
  contentType String
  sizeBytes   Int
  uploadedAt  DateTime  @default(now())
  uploadedById String

  order       Order     @relation(fields: [orderId], references: [id])

  @@index([orderId])
}

model AuditLog {
  id          String    @id @default(uuid())
  tenantId    String
  userId      String
  action      String
  entityType  String
  entityId    String
  changes     Json?
  createdAt   DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id])

  @@index([tenantId, entityType, entityId])
  @@index([tenantId, createdAt])
}

enum GlobalRole {
  ADMIN
  SELLER
}

enum TenantRole {
  SELLER
  ACCOUNTING_MANAGER
  ACCOUNTING_VIEWER
}

enum InviteStatus {
  PENDING
  ACCEPTED
  REVOKED
}

enum SubscriptionStatus {
  TRIAL
  ACTIVE
  PAST_DUE
  GRACE_PERIOD
  BLOCKED
  CANCELLED
}

enum OrderStatus {
  DRAFT
  CONFIRMED
  DELIVERED
  CANCELLED
}
```

## API Design

### Authentication Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| POST | /auth/register | Register new Seller | Public |
| POST | /auth/confirm | Confirm email | Public |
| POST | /auth/login | Login | Public |
| POST | /auth/forgot-password | Request password reset | Public |
| POST | /auth/reset-password | Reset password with code | Public |
| POST | /auth/invite | Invite accountant | Seller |
| POST | /auth/accept-invite | Accept invitation | Public (with token) |

### Supplier Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | /suppliers | List suppliers | Seller, Accounting_Manager, Accounting_Viewer |
| GET | /suppliers/:id | Get supplier details | Seller, Accounting_Manager, Accounting_Viewer |
| POST | /suppliers | Create supplier | Seller, Accounting_Manager |
| PATCH | /suppliers/:id | Update supplier | Seller, Accounting_Manager |
| DELETE | /suppliers/:id | Inactivate supplier | Seller, Accounting_Manager |

### Product Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | /products | List products | Seller, Accounting_Manager, Accounting_Viewer |
| GET | /products/:id | Get product details | Seller, Accounting_Manager, Accounting_Viewer |
| POST | /products | Create product | Seller, Accounting_Manager |
| PATCH | /products/:id | Update product | Seller, Accounting_Manager |
| DELETE | /products/:id | Inactivate product | Seller, Accounting_Manager |
| POST | /products/:id/suppliers | Associate supplier with price | Seller, Accounting_Manager |
| PATCH | /products/:id/suppliers/:supplierId | Update supplier price | Seller, Accounting_Manager |
| DELETE | /products/:id/suppliers/:supplierId | Remove supplier association | Seller, Accounting_Manager |

### Order Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | /orders | List orders | Seller, Accounting_Manager, Accounting_Viewer |
| GET | /orders/:id | Get order details | Seller, Accounting_Manager, Accounting_Viewer |
| POST | /orders | Create order | Seller, Accounting_Manager |
| PATCH | /orders/:id | Update order | Seller, Accounting_Manager |
| PATCH | /orders/:id/status | Update order status | Seller, Accounting_Manager |
| POST | /orders/:id/items | Add order item | Seller, Accounting_Manager |
| PATCH | /orders/:id/items/:itemId | Update order item | Seller, Accounting_Manager |
| DELETE | /orders/:id/items/:itemId | Remove order item | Seller, Accounting_Manager |

### Invoice Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | /orders/:id/invoices | List invoices for order | All authenticated |
| POST | /orders/:id/invoices/upload-url | Get presigned upload URL | Seller, Accounting_Manager |
| POST | /orders/:id/invoices | Register uploaded invoice | Seller, Accounting_Manager |
| GET | /orders/:id/invoices/:invoiceId/download | Get presigned download URL | All authenticated |

### Subscription Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| POST | /subscriptions/checkout | Create Stripe checkout session | Seller |
| GET | /subscriptions/portal | Get Customer Portal URL | Seller |
| POST | /subscriptions/webhook | Stripe webhook handler | Stripe (verified) |
| GET | /subscriptions/status | Get current subscription status | Seller |

### Dashboard Endpoints

| Method | Path | Description | Roles |
|--------|------|-------------|-------|
| GET | /dashboard/summary | Get summary metrics | Seller, Accounting_Manager, Accounting_Viewer |
| GET | /dashboard/purchases | Get purchases list | Seller, Accounting_Manager, Accounting_Viewer |
| GET | /dashboard/export | Export CSV | Seller, Accounting_Manager, Accounting_Viewer |

## Component Design

### Backend Guards & Middleware

#### TenantGuard
```typescript
// Extracts tenant_id from JWT, sets on request context
// Applied globally via APP_GUARD
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;
    if (!tenantId) throw new ForbiddenException();
    request.tenantId = tenantId;
    return true;
  }
}
```

#### RolesGuard
```typescript
// Checks user's role within current tenant context
@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<TenantRole[]>('roles', context.getHandler());
    const request = context.switchToHttp().getRequest();
    return requiredRoles.includes(request.user.tenantRole);
  }
}
```

#### SubscriptionGuard
```typescript
// Blocks write operations when subscription is expired/grace period
@Injectable()
export class SubscriptionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    const status = request.tenant.subscriptionStatus;
    
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return ['ACTIVE', 'TRIAL'].includes(status);
    }
    return status !== 'BLOCKED';
  }
}
```

### Prisma Tenant Middleware
```typescript
// Automatically injects tenant_id in all queries
prisma.$use(async (params, next) => {
  const tenantId = cls.get('tenantId');
  if (tenantId && TENANT_SCOPED_MODELS.includes(params.model)) {
    if (params.action === 'findMany' || params.action === 'findFirst') {
      params.args.where = { ...params.args.where, tenantId };
    }
    if (params.action === 'create') {
      params.args.data = { ...params.args.data, tenantId };
    }
  }
  return next(params);
});
```

### Frontend Architecture

#### State Management
- Server state: TanStack Query (React Query) for data fetching and caching
- URL state: Next.js searchParams for filters and pagination
- Local state: React useState for UI interactions

#### Key Pages
- `/login` — Login page
- `/register` — Seller registration
- `/dashboard` — Main analytics dashboard
- `/suppliers` — Supplier CRUD list
- `/suppliers/[id]` — Supplier detail/edit
- `/products` — Product CRUD list
- `/products/[id]` — Product detail/edit
- `/orders` — Orders list
- `/orders/[id]` — Order detail with items and invoices
- `/orders/new` — Create new order
- `/settings/subscription` — Subscription management
- `/settings/team` — Invite and manage accountants

### Docker Development Environment

```yaml
# docker-compose.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: comprashub
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  localstack:
    image: localstack/localstack:latest
    environment:
      SERVICES: s3
      DEFAULT_REGION: us-east-1
    ports:
      - "4566:4566"

  stripe-cli:
    image: stripe/stripe-cli:latest
    command: listen --forward-to http://api:3001/subscriptions/webhook
    environment:
      STRIPE_API_KEY: ${STRIPE_SECRET_KEY}

  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile.dev
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/comprashub
      AWS_ENDPOINT: http://localstack:4566
      S3_BUCKET: invoices-dev
    ports:
      - "3001:3001"
    depends_on:
      - postgres
      - localstack

  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile.dev
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001
    ports:
      - "3000:3000"
    depends_on:
      - api

volumes:
  pgdata:
```

## Security Design

### Request Flow Security

1. **API Gateway** — Rate limiting, WAF rules
2. **Cognito JWT Verification** — Token validation on every request
3. **TenantGuard** — Extract and enforce tenant_id from JWT
4. **RolesGuard** — Check role-based access per endpoint
5. **SubscriptionGuard** — Block writes when subscription inactive
6. **DTO Validation** — class-validator on all request bodies
7. **Prisma Middleware** — Automatic tenant_id injection in queries

### Secrets Management
- All secrets stored in AWS Secrets Manager
- Local dev uses .env file (gitignored)
- CI/CD retrieves secrets at deploy time
- Never logged, never in responses

## Correctness Properties

### Property 1: Order Total Calculation Integrity
- **Requirement:** 6.2 (Order total = sum of line item subtotals)
- **Property:** For all valid orders, the order total equals the sum of (quantidade × precoUnit) for each item
- **Type:** Invariant
- **Testable:** yes - property

### Property 2: Tenant Data Isolation
- **Requirement:** 9.3, 9.4 (TenantGuard, 403 on cross-tenant access)
- **Property:** For any query executed by user U belonging to tenant T, no records from tenant T' (where T ≠ T') are ever returned
- **Type:** Invariant
- **Testable:** yes - property

### Property 3: CNPJ Uniqueness Per Tenant
- **Requirement:** 4.2 (CNPJ unique within tenant)
- **Property:** For any tenant, no two active suppliers share the same CNPJ; different tenants may have suppliers with the same CNPJ
- **Type:** Invariant
- **Testable:** yes - property

### Property 4: Soft Delete Integrity
- **Requirement:** 4.3, 5.3 (Prevent physical deletion when orders exist)
- **Property:** For any supplier or product with at least one linked order, a delete operation results in inactivation (active=false) and never physical removal from the database
- **Type:** Invariant
- **Testable:** yes - property

### Property 5: Subscription State Machine Consistency
- **Requirement:** 3.4, 3.5, 3.6 (Subscription status transitions)
- **Property:** Subscription status transitions follow valid paths: TRIAL→ACTIVE, ACTIVE→PAST_DUE, PAST_DUE→GRACE_PERIOD, GRACE_PERIOD→BLOCKED, any→CANCELLED, GRACE_PERIOD→ACTIVE (renewal)
- **Type:** Invariant (state machine)
- **Testable:** yes - property

### Property 6: Role-Based Write Access Enforcement
- **Requirement:** 1.5, 8.7 (Accounting_Viewer read-only)
- **Property:** For any user with Accounting_Viewer role, all POST/PATCH/PUT/DELETE requests to CRUD endpoints return 403 Forbidden
- **Type:** Invariant
- **Testable:** yes - property

### Property 7: Audit Trail Completeness
- **Requirement:** 11.1, 11.2, 11.3 (Audit fields on all records)
- **Property:** For any create or update operation on Supplier, Product, or Order, the resulting record has non-null created_at, updated_at, and responsible_user_id fields where updated_at >= created_at
- **Type:** Invariant
- **Testable:** yes - property

### Property 8: Presigned URL Security
- **Requirement:** 7.1, 7.2 (Presigned URL generation with correct path)
- **Property:** For any generated presigned URL, the S3 key follows the pattern notas-fiscais/{tenant_id}/{pedido_id}/{filename} where tenant_id matches the requesting user's tenant
- **Type:** Invariant
- **Testable:** yes - property

### Property 9: Subscription Guard Write Block
- **Requirement:** 3.5, 14.2 (Read-only mode during grace period)
- **Property:** While a tenant's subscription status is GRACE_PERIOD or BLOCKED, all write operations (POST, PATCH, PUT, DELETE) on business entities return an error response, but read operations succeed
- **Type:** State-driven invariant
- **Testable:** yes - property

### Property 10: Dashboard Data Consistency
- **Requirement:** 8.3 (Summary metrics match actual data)
- **Property:** The total amount spent reported by the dashboard equals the sum of all order totals within the selected date range for the tenant
- **Type:** Model-based (compare aggregation query vs sum of individual records)
- **Testable:** yes - property
