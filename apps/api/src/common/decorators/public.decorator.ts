import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as public — bypasses TenantGuard and tenant context.
 * Use for auth endpoints (login, register, etc.) that don't require a tenant.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
