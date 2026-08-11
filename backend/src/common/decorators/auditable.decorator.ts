import { SetMetadata } from '@nestjs/common';

export const AUDITABLE_KEY = 'auditable_entity_type';

/**
 * Alias constant for the audit entity metadata key.
 * Can be referenced as AUDIT_ENTITY_KEY or AUDITABLE_KEY.
 */
export const AUDIT_ENTITY_KEY = AUDITABLE_KEY;

/**
 * Marks a handler or controller for automatic audit trail logging.
 * The interceptor reads this metadata to determine the entityType
 * for the AuditLog entry.
 *
 * Can be applied at the controller level (to audit all write operations in the controller)
 * or at the handler level (to audit specific endpoints).
 *
 * @param entityType - The entity type string (e.g., 'Supplier', 'Product', 'Order')
 */
export const Auditable = (entityType: string) =>
  SetMetadata(AUDITABLE_KEY, entityType);

/**
 * Alias for @Auditable decorator.
 * Marks a handler or controller for automatic audit trail logging.
 *
 * @param entityType - The entity type string (e.g., 'Supplier', 'Product', 'Order')
 */
export const AuditEntity = Auditable;
