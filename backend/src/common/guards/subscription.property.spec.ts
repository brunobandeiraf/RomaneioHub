import * as fc from 'fast-check';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole, SubscriptionStatus } from '../../shared/index';
import { SubscriptionGuard } from './subscription.guard';

/**
 * Property 9: Subscription Guard Write Block
 *
 * While a tenant's subscription status is GRACE_PERIOD or BLOCKED,
 * all write operations (POST, PATCH, PUT, DELETE) on business entities
 * return an error response, but read operations succeed.
 *
 * **Validates: Requirements 3.5, 14.2**
 */
describe('Property 9: Subscription Guard Write Block', () => {
  let guard: SubscriptionGuard;
  let reflector: Reflector;
  let prisma: any;

  // Arbitraries
  const writeMethods = ['POST', 'PATCH', 'PUT', 'DELETE'] as const;
  const writeMethodArb = fc.constantFrom(...writeMethods);
  const allMethodArb = fc.constantFrom('GET', 'POST', 'PATCH', 'PUT', 'DELETE');

  const subscriptionStatusArb = fc.constantFrom(
    ...Object.values(SubscriptionStatus),
  );

  const gracePeriodOrPastDueArb = fc.constantFrom(
    SubscriptionStatus.GRACE_PERIOD,
    SubscriptionStatus.PAST_DUE,
  );

  const activeOrTrialArb = fc.constantFrom(
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.TRIAL,
  );

  // Non-whitelisted paths for business entities
  const businessPathArb = fc.constantFrom(
    '/suppliers',
    '/suppliers/123',
    '/products',
    '/products/456',
    '/orders',
    '/orders/789',
    '/orders/789/items',
    '/orders/789/items/111',
    '/orders/789/invoices',
  );

  // Whitelisted paths that BLOCKED status allows for GET
  const whitelistedPathArb = fc.constantFrom(
    '/dashboard/export',
    '/dashboard/export/csv',
    '/subscriptions',
    '/subscriptions/status',
    '/subscriptions/portal',
    '/auth/login',
    '/auth/refresh',
  );

  const tenantIdArb = fc.uuid();

  function createMockContext(
    method: string,
    tenantId: string | undefined,
    user: { globalRole?: string } | null,
    path: string,
  ) {
    const request = {
      method,
      tenantId,
      user,
      path,
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as any;
  }

  beforeEach(() => {
    reflector = new Reflector();
    prisma = {
      tenant: {
        findUnique: jest.fn(),
      },
    };
    guard = new SubscriptionGuard(reflector, prisma);
    // Default: no @SkipSubscriptionCheck decorator
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
  });

  describe('GRACE_PERIOD / PAST_DUE: GET allowed, writes blocked', () => {
    it('should block all write operations when status is GRACE_PERIOD or PAST_DUE', async () => {
      await fc.assert(
        fc.asyncProperty(
          gracePeriodOrPastDueArb,
          writeMethodArb,
          tenantIdArb,
          businessPathArb,
          async (status, method, tenantId, path) => {
            prisma.tenant.findUnique.mockResolvedValue({
              subscriptionStatus: status,
            });

            const context = createMockContext(
              method,
              tenantId,
              { globalRole: GlobalRole.SELLER },
              path,
            );

            await expect(guard.canActivate(context)).rejects.toThrow(
              ForbiddenException,
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should allow GET requests when status is GRACE_PERIOD or PAST_DUE', async () => {
      await fc.assert(
        fc.asyncProperty(
          gracePeriodOrPastDueArb,
          tenantIdArb,
          businessPathArb,
          async (status, tenantId, path) => {
            prisma.tenant.findUnique.mockResolvedValue({
              subscriptionStatus: status,
            });

            const context = createMockContext(
              'GET',
              tenantId,
              { globalRole: GlobalRole.SELLER },
              path,
            );

            const result = await guard.canActivate(context);
            expect(result).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('BLOCKED: all operations blocked except whitelisted GET paths', () => {
    it('should block all write operations regardless of path when BLOCKED', async () => {
      await fc.assert(
        fc.asyncProperty(
          writeMethodArb,
          tenantIdArb,
          fc.oneof(businessPathArb, whitelistedPathArb),
          async (method, tenantId, path) => {
            prisma.tenant.findUnique.mockResolvedValue({
              subscriptionStatus: SubscriptionStatus.BLOCKED,
            });

            const context = createMockContext(
              method,
              tenantId,
              { globalRole: GlobalRole.SELLER },
              path,
            );

            await expect(guard.canActivate(context)).rejects.toThrow(
              ForbiddenException,
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should block GET requests to non-whitelisted paths when BLOCKED', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          businessPathArb,
          async (tenantId, path) => {
            prisma.tenant.findUnique.mockResolvedValue({
              subscriptionStatus: SubscriptionStatus.BLOCKED,
            });

            const context = createMockContext(
              'GET',
              tenantId,
              { globalRole: GlobalRole.SELLER },
              path,
            );

            await expect(guard.canActivate(context)).rejects.toThrow(
              ForbiddenException,
            );
          },
        ),
        { numRuns: 50 },
      );
    });

    it('should allow GET requests to whitelisted paths when BLOCKED', async () => {
      await fc.assert(
        fc.asyncProperty(
          tenantIdArb,
          whitelistedPathArb,
          async (tenantId, path) => {
            prisma.tenant.findUnique.mockResolvedValue({
              subscriptionStatus: SubscriptionStatus.BLOCKED,
            });

            const context = createMockContext(
              'GET',
              tenantId,
              { globalRole: GlobalRole.SELLER },
              path,
            );

            const result = await guard.canActivate(context);
            expect(result).toBe(true);
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('ACTIVE / TRIAL: all operations allowed', () => {
    it('should allow all HTTP methods when status is ACTIVE or TRIAL', async () => {
      await fc.assert(
        fc.asyncProperty(
          activeOrTrialArb,
          allMethodArb,
          tenantIdArb,
          businessPathArb,
          async (status, method, tenantId, path) => {
            prisma.tenant.findUnique.mockResolvedValue({
              subscriptionStatus: status,
            });

            const context = createMockContext(
              method,
              tenantId,
              { globalRole: GlobalRole.SELLER },
              path,
            );

            const result = await guard.canActivate(context);
            expect(result).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Admin always bypasses subscription check', () => {
    it('should allow Admin users regardless of subscription status or HTTP method', async () => {
      await fc.assert(
        fc.asyncProperty(
          subscriptionStatusArb,
          allMethodArb,
          tenantIdArb,
          businessPathArb,
          async (status, method, tenantId, path) => {
            prisma.tenant.findUnique.mockResolvedValue({
              subscriptionStatus: status,
            });

            const context = createMockContext(
              method,
              tenantId,
              { globalRole: GlobalRole.ADMIN },
              path,
            );

            const result = await guard.canActivate(context);
            expect(result).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should not call the database when Admin bypasses', async () => {
      await fc.assert(
        fc.asyncProperty(
          subscriptionStatusArb,
          allMethodArb,
          tenantIdArb,
          async (status, method, tenantId) => {
            prisma.tenant.findUnique.mockClear();

            const context = createMockContext(
              method,
              tenantId,
              { globalRole: GlobalRole.ADMIN },
              '/suppliers',
            );

            await guard.canActivate(context);
            expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 50 },
      );
    });
  });

  describe('Combined property: write blocking is status-driven', () => {
    it('write operations are blocked iff status is not ACTIVE/TRIAL (and user is not Admin)', async () => {
      await fc.assert(
        fc.asyncProperty(
          subscriptionStatusArb,
          writeMethodArb,
          tenantIdArb,
          businessPathArb,
          async (status, method, tenantId, path) => {
            prisma.tenant.findUnique.mockResolvedValue({
              subscriptionStatus: status,
            });

            const context = createMockContext(
              method,
              tenantId,
              { globalRole: GlobalRole.SELLER },
              path,
            );

            const isAllowedStatus =
              status === SubscriptionStatus.ACTIVE ||
              status === SubscriptionStatus.TRIAL;

            if (isAllowedStatus) {
              const result = await guard.canActivate(context);
              expect(result).toBe(true);
            } else {
              await expect(guard.canActivate(context)).rejects.toThrow(
                ForbiddenException,
              );
            }
          },
        ),
        { numRuns: 200 },
      );
    });
  });
});
