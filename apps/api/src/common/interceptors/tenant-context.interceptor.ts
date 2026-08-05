import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantContext } from '../../prisma/tenant-context';

/**
 * TenantContextInterceptor wraps the request handler execution within
 * TenantContext.run(), ensuring that all downstream Prisma queries
 * execute within the correct tenant's AsyncLocalStorage context.
 *
 * This interceptor runs AFTER guards (JwtAuthGuard, TenantGuard),
 * so request.tenantId is already set by the TenantGuard.
 *
 * The AsyncLocalStorage propagation ensures that even in async operations,
 * the Prisma query extension can retrieve the tenant_id automatically.
 *
 * @validates Requirements 9.2, 9.3
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly tenantContext: TenantContext) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId;

    // If no tenantId is set (public route or admin without tenant),
    // proceed without wrapping in tenant context
    if (!tenantId) {
      return next.handle();
    }

    // Wrap the handler execution in the tenant async context
    // so Prisma queries automatically pick up the tenantId
    return new Observable((subscriber) => {
      this.tenantContext.run(tenantId, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
