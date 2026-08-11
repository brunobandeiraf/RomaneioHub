import * as fc from 'fast-check';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole, TenantRole } from '../../shared/index';
import { RolesGuard } from './roles.guard';

/**
 * Property 6: Role-Based Write Access Enforcement
 *
 * For any user with Accounting_Viewer role, all POST/PATCH/PUT/DELETE requests
 * to CRUD endpoints return 403 Forbidden.
 *
 * **Validates: Requirements 1.5**
 *
 * This test uses fast-check to generate random endpoint configurations and verify:
 * - Any endpoint requiring write access (SELLER or ACCOUNTING_MANAGER roles) rejects ACCOUNTING_VIEWER
 * - Random HTTP methods (POST, PATCH, PUT, DELETE) with ACCOUNTING_VIEWER role always get 403
 * - GET requests with ACCOUNTING_VIEWER are always allowed when the endpoint includes ACCOUNTING_VIEWER in its role list
 * - Admin role always bypasses role checks regardless of required roles
 */
describe('Property 6: Role-Based Write Access Enforcement', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  /**
   * Creates a mock ExecutionContext with a given user and required roles metadata.
   */
  function createMockContext(user: any, requiredRoles: TenantRole[]) {
    jest.spyOn(reflector, 'get').mockReturnValue(requiredRoles);
    return {
      getHandler: () => jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  }

  // --- Arbitraries ---

  // Write-only role sets: endpoints that require SELLER or ACCOUNTING_MANAGER but NOT ACCOUNTING_VIEWER
  const writeOnlyRolesArb = fc.constantFrom(
    [TenantRole.SELLER],
    [TenantRole.ACCOUNTING_MANAGER],
    [TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER],
  );

  // Any non-empty subset of roles (for general endpoint configurations)
  const anyRoleSetArb = fc
    .subarray(
      [TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER, TenantRole.ACCOUNTING_VIEWER],
      { minLength: 1 },
    );

  // Write HTTP methods
  const writeMethodArb = fc.constantFrom('POST', 'PATCH', 'PUT', 'DELETE');

  // All HTTP methods
  const anyMethodArb = fc.constantFrom('GET', 'POST', 'PATCH', 'PUT', 'DELETE');

  // Random user ID for realism
  const userIdArb = fc.uuid();

  describe('ACCOUNTING_VIEWER is rejected on write-only endpoints', () => {
    it('should return 403 for ACCOUNTING_VIEWER on any endpoint requiring only SELLER/ACCOUNTING_MANAGER', () => {
      fc.assert(
        fc.property(
          writeOnlyRolesArb,
          writeMethodArb,
          userIdArb,
          (requiredRoles, _method, userId) => {
            const user = {
              id: userId,
              globalRole: GlobalRole.SELLER,
              tenantRole: TenantRole.ACCOUNTING_VIEWER,
            };

            const context = createMockContext(user, requiredRoles);

            // Property: ACCOUNTING_VIEWER must be rejected with ForbiddenException
            expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe('ACCOUNTING_VIEWER is rejected regardless of HTTP method on write-only endpoints', () => {
    it('should return 403 for ACCOUNTING_VIEWER with any HTTP method when endpoint excludes ACCOUNTING_VIEWER', () => {
      fc.assert(
        fc.property(
          writeOnlyRolesArb,
          anyMethodArb,
          userIdArb,
          (requiredRoles, _method, userId) => {
            const user = {
              id: userId,
              globalRole: GlobalRole.SELLER,
              tenantRole: TenantRole.ACCOUNTING_VIEWER,
            };

            const context = createMockContext(user, requiredRoles);

            // Property: If endpoint does not list ACCOUNTING_VIEWER, it must be rejected
            // regardless of the HTTP method used
            expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe('ACCOUNTING_VIEWER is allowed on endpoints that include it in role list', () => {
    it('should allow ACCOUNTING_VIEWER when endpoint role list includes ACCOUNTING_VIEWER', () => {
      // Generate role sets that always include ACCOUNTING_VIEWER
      const rolesIncludingViewerArb = fc
        .subarray(
          [TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER],
          { minLength: 0 },
        )
        .map((roles) => [...roles, TenantRole.ACCOUNTING_VIEWER]);

      fc.assert(
        fc.property(
          rolesIncludingViewerArb,
          userIdArb,
          (requiredRoles, userId) => {
            const user = {
              id: userId,
              globalRole: GlobalRole.SELLER,
              tenantRole: TenantRole.ACCOUNTING_VIEWER,
            };

            const context = createMockContext(user, requiredRoles);

            // Property: ACCOUNTING_VIEWER is granted access when explicitly listed
            expect(guard.canActivate(context)).toBe(true);
          },
        ),
        { numRuns: 200 },
      );
    });
  });

  describe('Admin role always bypasses role checks', () => {
    it('should allow ADMIN user regardless of required roles and tenant role', () => {
      const tenantRoleArb = fc.constantFrom(
        TenantRole.SELLER,
        TenantRole.ACCOUNTING_MANAGER,
        TenantRole.ACCOUNTING_VIEWER,
        undefined,
      );

      fc.assert(
        fc.property(
          anyRoleSetArb,
          tenantRoleArb,
          userIdArb,
          (requiredRoles, tenantRole, userId) => {
            const user: any = {
              id: userId,
              globalRole: GlobalRole.ADMIN,
            };
            if (tenantRole !== undefined) {
              user.tenantRole = tenantRole;
            }

            const context = createMockContext(user, requiredRoles);

            // Property: Admin ALWAYS bypasses role checks
            expect(guard.canActivate(context)).toBe(true);
          },
        ),
        { numRuns: 200 },
      );
    });

    it('should allow ADMIN even on strictly write-only endpoints', () => {
      fc.assert(
        fc.property(
          writeOnlyRolesArb,
          writeMethodArb,
          userIdArb,
          (requiredRoles, _method, userId) => {
            const user = {
              id: userId,
              globalRole: GlobalRole.ADMIN,
              tenantRole: TenantRole.ACCOUNTING_VIEWER, // Even with viewer role, admin bypasses
            };

            const context = createMockContext(user, requiredRoles);

            // Property: Admin bypasses even with ACCOUNTING_VIEWER tenantRole
            expect(guard.canActivate(context)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Non-viewer write roles are always accepted on matching endpoints', () => {
    it('should allow SELLER on any endpoint that lists SELLER in required roles', () => {
      const rolesIncludingSellerArb = fc
        .subarray(
          [TenantRole.ACCOUNTING_MANAGER, TenantRole.ACCOUNTING_VIEWER],
          { minLength: 0 },
        )
        .map((roles) => [...roles, TenantRole.SELLER]);

      fc.assert(
        fc.property(
          rolesIncludingSellerArb,
          writeMethodArb,
          userIdArb,
          (requiredRoles, _method, userId) => {
            const user = {
              id: userId,
              globalRole: GlobalRole.SELLER,
              tenantRole: TenantRole.SELLER,
            };

            const context = createMockContext(user, requiredRoles);

            // Property: SELLER is accepted on endpoints that include SELLER
            expect(guard.canActivate(context)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should allow ACCOUNTING_MANAGER on any endpoint that lists ACCOUNTING_MANAGER in required roles', () => {
      const rolesIncludingManagerArb = fc
        .subarray(
          [TenantRole.SELLER, TenantRole.ACCOUNTING_VIEWER],
          { minLength: 0 },
        )
        .map((roles) => [...roles, TenantRole.ACCOUNTING_MANAGER]);

      fc.assert(
        fc.property(
          rolesIncludingManagerArb,
          writeMethodArb,
          userIdArb,
          (requiredRoles, _method, userId) => {
            const user = {
              id: userId,
              globalRole: GlobalRole.SELLER,
              tenantRole: TenantRole.ACCOUNTING_MANAGER,
            };

            const context = createMockContext(user, requiredRoles);

            // Property: ACCOUNTING_MANAGER is accepted on endpoints that include it
            expect(guard.canActivate(context)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
