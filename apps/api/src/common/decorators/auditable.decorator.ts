import { SetMetadata } from '@nestjs/common';

export const AUDITABLE_KEY = 'auditable_entity_type';

/**
 * Marks a handler for automatic audit trail logging.
 * The interceptor reads this metadata to determine the entityType
 * for the AuditLog entry.
 *
 * @param entityType - The entity type string (e.g., 'Supplier', 'Product', 'Order')
 */
export const Auditable = (entityType: string) =>
  SetMetadata(AUDITABLE_KEY, entityType);
