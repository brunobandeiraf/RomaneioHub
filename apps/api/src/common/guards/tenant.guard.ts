import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * TenantGuard extracts tenant_id from the authenticated user's JWT claims
 * (already parsed onto request.user by a preceding auth guard/middleware).
 *
 * - If the route is marked @Public(), the guard passes immediately.
 * - If request.user is missing or has no tenantId, returns 401.
 * - If the user has globalRole === 'ADMIN', sets a bypass flag for cross-tenant read.
 * - Otherwise, sets request.tenantId from the JWT claims.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

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
      throw new UnauthorizedException(
        'Authentication required: no user context found',
      );
    }

    // Admin users bypass tenant filtering for cross-tenant read access
    if (user.globalRole === 'ADMIN') {
      request.tenantId = user.tenantId ?? null;
      request.isTenantBypassed = true;
      return true;
    }

    // For non-admin users, tenantId is mandatory
    if (!user.tenantId) {
      throw new UnauthorizedException(
        'Authentication required: missing tenant context',
      );
    }

    request.tenantId = user.tenantId;
    request.isTenantBypassed = false;
    return true;
  }
}
