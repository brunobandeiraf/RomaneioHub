import { OrderStatus, SubscriptionStatus } from '../types';

/** Maximum file size for invoice uploads (10 MB) */
export const MAX_INVOICE_FILE_SIZE = 10 * 1024 * 1024;

/** Allowed content types for invoice uploads */
export const ALLOWED_INVOICE_CONTENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;

/** Maximum number of invoices per order */
export const MAX_INVOICES_PER_ORDER = 10;

/** Maximum number of line items per order */
export const MAX_ORDER_ITEMS = 50;

/** Minimum number of line items per order */
export const MIN_ORDER_ITEMS = 1;

/** Presigned URL expiration time (15 minutes in seconds) */
export const PRESIGNED_URL_EXPIRY_SECONDS = 15 * 60;

/** Grace period duration in days */
export const GRACE_PERIOD_DAYS = 7;

/** Cancellation grace period in days */
export const CANCELLATION_GRACE_PERIOD_DAYS = 30;

/** Pagination default page size */
export const DEFAULT_PAGE_SIZE = 20;

/** Access token expiration in seconds (1 hour) */
export const ACCESS_TOKEN_EXPIRY_SECONDS = 3600;

/** Refresh token expiration in days (30 days) */
export const REFRESH_TOKEN_EXPIRY_DAYS = 30;

/** Invitation link validity in hours */
export const INVITE_LINK_VALIDITY_HOURS = 48;

/** Email confirmation link validity in hours */
export const CONFIRM_LINK_VALIDITY_HOURS = 24;

/** Password recovery code validity in minutes */
export const RECOVERY_CODE_VALIDITY_MINUTES = 15;

/** Rate limiting: max requests per window */
export const RATE_LIMIT_MAX_REQUESTS = 100;

/** Rate limiting: window duration in seconds */
export const RATE_LIMIT_WINDOW_SECONDS = 60;

/** Valid order status transitions */
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.DRAFT]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

/**
 * Valid subscription status transitions.
 * TRIAL→ACTIVE, ACTIVE→PAST_DUE, PAST_DUE→GRACE_PERIOD,
 * GRACE_PERIOD→BLOCKED, GRACE_PERIOD→ACTIVE (renewal),
 * any→CANCELLED
 */
export const VALID_SUBSCRIPTION_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  [SubscriptionStatus.TRIAL]: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELLED],
  [SubscriptionStatus.ACTIVE]: [SubscriptionStatus.PAST_DUE, SubscriptionStatus.CANCELLED],
  [SubscriptionStatus.PAST_DUE]: [SubscriptionStatus.GRACE_PERIOD, SubscriptionStatus.CANCELLED],
  [SubscriptionStatus.GRACE_PERIOD]: [
    SubscriptionStatus.BLOCKED,
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.CANCELLED,
  ],
  [SubscriptionStatus.BLOCKED]: [SubscriptionStatus.CANCELLED],
  [SubscriptionStatus.CANCELLED]: [],
};

/** Storage key prefix for invoice files */
export const INVOICE_STORAGE_KEY_PREFIX = 'notas-fiscais';

/** Models that are scoped by tenant */
export const TENANT_SCOPED_MODELS = [
  'Supplier',
  'Product',
  'Order',
  'AuditLog',
] as const;
