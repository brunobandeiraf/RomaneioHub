import { Prisma } from '@compras-hub/db';
import { TENANT_SCOPED_MODELS } from '@compras-hub/shared';
import { TenantContext } from './tenant-context';

/**
 * Creates a Prisma Client Extension that automatically injects tenant_id
 * into queries for tenant-scoped models (Supplier, Product, Order, AuditLog).
 *
 * Uses AsyncLocalStorage via TenantContext to retrieve the current tenant.
 * Skips injection if tenantId is not set (admin or system operations).
 */
export function createTenantExtension(tenantContext: TenantContext) {
  return Prisma.defineExtension((client) => {
    return client.$extends({
      query: {
        $allModels: {
          async findMany({ model, args, query }) {
            injectTenantWhereClause(model, args, tenantContext);
            return query(args);
          },
          async findFirst({ model, args, query }) {
            injectTenantWhereClause(model, args, tenantContext);
            return query(args);
          },
          async findUnique({ model, args, query }) {
            injectTenantWhereClause(model, args, tenantContext);
            return query(args);
          },
          async create({ model, args, query }) {
            injectTenantDataClause(model, args, tenantContext);
            return query(args);
          },
          async update({ model, args, query }) {
            injectTenantWhereClause(model, args, tenantContext);
            return query(args);
          },
          async updateMany({ model, args, query }) {
            injectTenantWhereClause(model, args, tenantContext);
            return query(args);
          },
          async delete({ model, args, query }) {
            injectTenantWhereClause(model, args, tenantContext);
            return query(args);
          },
          async deleteMany({ model, args, query }) {
            injectTenantWhereClause(model, args, tenantContext);
            return query(args);
          },
        },
      },
    });
  });
}

function isTenantScopedModel(model: string | undefined): boolean {
  if (!model) return false;
  return TENANT_SCOPED_MODELS.includes(model as (typeof TENANT_SCOPED_MODELS)[number]);
}

function injectTenantWhereClause(
  model: string | undefined,
  args: any,
  tenantContext: TenantContext,
): void {
  const tenantId = tenantContext.getTenantId();
  if (!tenantId || !isTenantScopedModel(model)) return;

  args.where = { ...args.where, tenantId };
}

function injectTenantDataClause(
  model: string | undefined,
  args: any,
  tenantContext: TenantContext,
): void {
  const tenantId = tenantContext.getTenantId();
  if (!tenantId || !isTenantScopedModel(model)) return;

  args.data = { ...args.data, tenantId };
}
