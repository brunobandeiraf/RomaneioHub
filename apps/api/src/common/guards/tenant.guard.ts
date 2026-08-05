import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TenantContext } from '../../prisma/tenant-context';

/**
 * TenantGuard extracts tenant_id from the authenticated user's JWT claims
 * (already parsed onto request.user by JwtAuthGuard).
 *
 * Responsibilities:
 * - If the route is marked @Public(), the guard passes immediately.
 * - If request.user is missing or has no tenantId, returns 401.
 * - If the user has globalRole === 'ADMIN', bypasses tenant enforcement
 *   (cross-tenant read access) but still sets tenantId if provided.
 * - Otherwise, sets request.tenantId from the JWT claims.
 * - Uses TenantContext (AsyncLocalStorage) to propagate the tenant scope
 *   for downstream Prisma queries.
 *
 * Note: The actual AsyncLocalStorage.run() wrapping is handled by
 * TenantContextInterceptor which runs after guards. This guard validates
 * and enforces tenant access, and sets request.tenantId for the interceptor.
 *
 * @see TenantContextInterceptor for the AsyncLocalStorage context wrapping
 * @validates Requirements 9.2, 9.6, 9.7
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tenantContext: TenantContext,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Skip tenant enforcement for public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // If no user is set (JWT not parsed yet or invalid), deny
    if (!user) {
      throw new UnauthorizedException('Missing tenant context');
    }

    // Admin users bypass tenant filtering for cross-tenant read access (Req 9.7)
    if (user.globalRole === 'ADMIN') {
      request.tenantId = user.tenantId ?? null;
      request.isTenantBypassed = true;
      return true;
    }

    // For non-admin users, tenantId is mandatory (Req 9.6)
    if (!user.tenantId) {
      throw new UnauthorizedException('Missing tenant context');
    }

    // Set tenantId on request for downstream use (Req 9.2)
    request.tenantId = user.tenantId;
    request.isTenantBypassed = false;
    return true;
  }
}
