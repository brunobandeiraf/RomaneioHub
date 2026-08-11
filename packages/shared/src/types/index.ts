// ─── Enums ───────────────────────────────────────────────────────────────────

export enum GlobalRole {
  ADMIN = 'ADMIN',
  SELLER = 'SELLER',
}

export enum TenantRole {
  SELLER = 'SELLER',
  ACCOUNTING_MANAGER = 'ACCOUNTING_MANAGER',
  ACCOUNTING_VIEWER = 'ACCOUNTING_VIEWER',
}

export enum InviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REVOKED = 'REVOKED',
}

export enum SubscriptionStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  PAST_DUE = 'PAST_DUE',
  GRACE_PERIOD = 'GRACE_PERIOD',
  BLOCKED = 'BLOCKED',
  CANCELLED = 'CANCELLED',
}

export enum OrderStatus {
  DRAFT = 'DRAFT',
  CONFIRMED = 'CONFIRMED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

// ─── Entity Interfaces ───────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  name: string;
  stripeCustomerId: string | null;
  subscriptionStatus: SubscriptionStatus;
  gracePeriodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  authId: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
  mfaEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserTenant {
  id: string;
  userId: string;
  tenantId: string;
  role: TenantRole;
  status: InviteStatus;
  invitedAt: Date;
  acceptedAt: Date | null;
}

export interface Supplier {
  id: string;
  tenantId: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  contato: string | null;
  endereco: Record<string, unknown> | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  updatedById: string;
}

export interface Product {
  id: string;
  tenantId: string;
  nome: string;
  categoria: string;
  unidade: string;
  precoReferencia: string; // Decimal stored as string for precision
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  updatedById: string;
}

export interface ProductSupplier {
  id: string;
  productId: string;
  supplierId: string;
  price: string; // Decimal stored as string for precision
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  tenantId: string;
  supplierId: string;
  date: Date;
  status: OrderStatus;
  total: string; // Decimal stored as string for precision
  createdAt: Date;
  updatedAt: Date;
  createdById: string;
  updatedById: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantidade: string; // Decimal 12,3 stored as string for precision
  precoUnit: string; // Decimal 12,2 stored as string for precision
  subtotal: string; // Decimal 12,2 stored as string for precision
}

export interface Invoice {
  id: string;
  orderId: string;
  filename: string;
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: Date;
  uploadedById: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes: Record<string, unknown> | null;
  createdAt: Date;
}
