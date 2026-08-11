// =============================================================================
// Shared types, constants and validators (internalized from @romaneio-hub/shared)
// =============================================================================

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

// ─── Constants ───────────────────────────────────────────────────────────────

export const MAX_INVOICE_FILE_SIZE = 10 * 1024 * 1024;
export const ALLOWED_INVOICE_CONTENT_TYPES = ['application/pdf', 'image/png', 'image/jpeg'] as const;
export const MAX_INVOICES_PER_ORDER = 10;
export const MAX_ORDER_ITEMS = 50;
export const MIN_ORDER_ITEMS = 1;
export const PRESIGNED_URL_EXPIRY_SECONDS = 15 * 60;
export const GRACE_PERIOD_DAYS = 7;
export const CANCELLATION_GRACE_PERIOD_DAYS = 30;
export const DEFAULT_PAGE_SIZE = 20;
export const ACCESS_TOKEN_EXPIRY_SECONDS = 3600;
export const REFRESH_TOKEN_EXPIRY_DAYS = 30;
export const INVITE_LINK_VALIDITY_HOURS = 48;
export const CONFIRM_LINK_VALIDITY_HOURS = 24;
export const RECOVERY_CODE_VALIDITY_MINUTES = 15;
export const RATE_LIMIT_MAX_REQUESTS = 100;
export const RATE_LIMIT_WINDOW_SECONDS = 60;
export const INVOICE_STORAGE_KEY_PREFIX = 'notas-fiscais';
export const TENANT_SCOPED_MODELS = ['Supplier', 'Product', 'Order', 'AuditLog'] as const;

export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.DRAFT]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

export const VALID_SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  [SubscriptionStatus.TRIAL]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED],
  [SubscriptionStatus.ACTIVE]: [SubscriptionStatus.PAST_DUE, SubscriptionStatus.CANCELLED],
  [SubscriptionStatus.PAST_DUE]: [SubscriptionStatus.GRACE_PERIOD, SubscriptionStatus.CANCELLED],
  [SubscriptionStatus.GRACE_PERIOD]: [SubscriptionStatus.BLOCKED, SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED],
  [SubscriptionStatus.BLOCKED]: [SubscriptionStatus.CANCELLED],
  [SubscriptionStatus.CANCELLED]: [],
};

// ─── Validators ──────────────────────────────────────────────────────────────

export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters long');
  if (password.length > 128) errors.push('Password must be at most 128 characters long');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
  if (!/\d/.test(password)) errors.push('Password must contain at least one number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) errors.push('Password must contain at least one special character');
  return { valid: errors.length === 0, errors };
}

export function validateCnpj(cnpj: string): boolean {
  const cleaned = cnpj.replace(/[.\-/]/g, '');
  if (cleaned.length !== 14) return false;
  if (/^(\d)\1+$/.test(cleaned)) return false;
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const digits = cleaned.split('').map(Number);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += digits[i] * weights1[i];
  let remainder = sum % 11;
  if (digits[12] !== (remainder < 2 ? 0 : 11 - remainder)) return false;
  sum = 0;
  for (let i = 0; i < 13; i++) sum += digits[i] * weights2[i];
  remainder = sum % 11;
  return digits[13] === (remainder < 2 ? 0 : 11 - remainder);
}

export function formatCnpj(cnpj: string): string {
  const cleaned = cnpj.replace(/\D/g, '');
  if (cleaned.length !== 14) return cnpj;
  return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12, 14)}`;
}
