import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';

interface TenantStore {
  tenantId: string;
}

/**
 * AsyncLocalStorage-based context for propagating tenantId
 * from the request scope into Prisma query extensions.
 */
@Injectable()
export class TenantContext {
  private readonly storage = new AsyncLocalStorage<TenantStore>();

  /**
   * Runs a callback within a tenant-scoped context.
   * All Prisma queries inside the callback will automatically
   * have tenant_id injected by the query extension.
   */
  run<T>(tenantId: string, callback: () => T): T {
    return this.storage.run({ tenantId }, callback);
  }

  /**
   * Retrieves the current tenantId from the async context.
   * Returns undefined if called outside of a tenant-scoped context
   * (e.g., for admin cross-tenant operations or system-level tasks).
   */
  getTenantId(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }
}
