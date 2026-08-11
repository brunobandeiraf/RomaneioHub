import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole, TenantRole } from '@romaneio-hub/shared';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<TenantRole[]>(
      ROLES_KEY,
      context.getHandler(),
    );

    // If no roles are specified, allow access (no role restriction)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Forbidden');
    }

    // Admin users bypass role checks
    if (user.globalRole === GlobalRole.ADMIN) {
      return true;
    }

    if (!user.tenantRole) {
      throw new ForbiddenException('Forbidden');
    }

    const hasRole = requiredRoles.includes(user.tenantRole);

    if (!hasRole) {
      throw new ForbiddenException('Forbidden');
    }

    return true;
  }
}
