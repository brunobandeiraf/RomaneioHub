import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContext } from '../../prisma/tenant-context';

/**
 * Middleware that wraps the request execution within TenantContext.run().
 * This ensures that all downstream code (guards, interceptors, handlers)
 * runs within the AsyncLocalStorage tenant context, making the tenantId
 * available to the Prisma query extension for automatic tenant filtering.
 *
 * This middleware should run AFTER authentication middleware populates request.user,
 * so that the tenantId from JWT is available.
 */
@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContext) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const user = (req as any).user;
    const tenantId = user?.tenantId;

    // If there's no tenantId yet (user not authenticated or public route),
    // proceed without tenant context — the TenantGuard will handle enforcement.
    if (!tenantId) {
      next();
      return;
    }

    // Wrap the rest of the request pipeline in the tenant async context
    this.tenantContext.run(tenantId, () => {
      next();
    });
  }
}
