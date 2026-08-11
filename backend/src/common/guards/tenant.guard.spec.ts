import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantGuard } from './tenant.guard';
import { TenantContext } from '../../prisma/tenant-context';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let reflector: Reflector;
  let tenantContext: TenantContext;

  beforeEach(() => {
    reflector = new Reflector();
    tenantContext = new TenantContext();
    guard = new TenantGuard(reflector, tenantContext);
  });

  function createMockContext(user: any, isPublic = false): ExecutionContext {
    const request = { user } as any;

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  }

  function getRequest(context: ExecutionContext) {
    return context.switchToHttp().getRequest() as any;
  }

  describe('public routes', () => {
    it('should allow access when route is marked @Public()', () => {
      const context = createMockContext(undefined, true);
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access on public route even without user', () => {
      const context = createMockContext(null, true);
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('unauthenticated requests', () => {
    it('should throw UnauthorizedException when user is undefined', () => {
      const context = createMockContext(undefined);
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Missing tenant context');
    });

    it('should throw UnauthorizedException when user is null', () => {
      const context = createMockContext(null);
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Missing tenant context');
    });
  });

  describe('non-admin users', () => {
    it('should set request.tenantId when user has a valid tenantId', () => {
      const user = {
        userId: 'user-1',
        email: 'test@example.com',
        tenantId: 'tenant-123',
        globalRole: 'SELLER',
        tenantRole: 'SELLER',
      };
      const context = createMockContext(user);

      expect(guard.canActivate(context)).toBe(true);

      const req = getRequest(context);
      expect(req.tenantId).toBe('tenant-123');
      expect(req.isTenantBypassed).toBe(false);
    });

    it('should throw UnauthorizedException when tenantId is missing', () => {
      const user = {
        userId: 'user-1',
        email: 'test@example.com',
        tenantId: undefined,
        globalRole: 'SELLER',
        tenantRole: 'SELLER',
      };
      const context = createMockContext(user);
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Missing tenant context');
    });

    it('should throw UnauthorizedException when tenantId is empty string', () => {
      const user = {
        userId: 'user-1',
        email: 'test@example.com',
        tenantId: '',
        globalRole: 'SELLER',
        tenantRole: 'SELLER',
      };
      const context = createMockContext(user);
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Missing tenant context');
    });

    it('should throw UnauthorizedException when tenantId is null', () => {
      const user = {
        userId: 'user-1',
        email: 'test@example.com',
        tenantId: null,
        globalRole: 'SELLER',
        tenantRole: 'SELLER',
      };
      const context = createMockContext(user);
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Missing tenant context');
    });
  });

  describe('admin users', () => {
    it('should allow access and set isTenantBypassed=true for Admin role', () => {
      const user = {
        userId: 'admin-1',
        email: 'admin@example.com',
        tenantId: 'tenant-admin',
        globalRole: 'ADMIN',
        tenantRole: null,
      };
      const context = createMockContext(user);

      expect(guard.canActivate(context)).toBe(true);

      const req = getRequest(context);
      expect(req.tenantId).toBe('tenant-admin');
      expect(req.isTenantBypassed).toBe(true);
    });

    it('should allow Admin access even without tenantId (cross-tenant)', () => {
      const user = {
        userId: 'admin-1',
        email: 'admin@example.com',
        tenantId: undefined,
        globalRole: 'ADMIN',
        tenantRole: null,
      };
      const context = createMockContext(user);

      expect(guard.canActivate(context)).toBe(true);

      const req = getRequest(context);
      expect(req.tenantId).toBeNull();
      expect(req.isTenantBypassed).toBe(true);
    });

    it('should set tenantId to null when Admin has no tenantId', () => {
      const user = {
        userId: 'admin-1',
        email: 'admin@example.com',
        globalRole: 'ADMIN',
      };
      const context = createMockContext(user);

      expect(guard.canActivate(context)).toBe(true);

      const req = getRequest(context);
      expect(req.tenantId).toBeNull();
      expect(req.isTenantBypassed).toBe(true);
    });
  });

  describe('tenant context integration', () => {
    it('should have TenantContext injected', () => {
      // Verify the guard has access to TenantContext for downstream use
      expect(guard).toBeDefined();
      expect(tenantContext).toBeDefined();
      expect(tenantContext.getTenantId()).toBeUndefined();
    });
  });

  describe('various roles', () => {
    it('should enforce tenantId for ACCOUNTING_MANAGER role', () => {
      const user = {
        userId: 'user-2',
        email: 'accountant@example.com',
        tenantId: 'tenant-456',
        globalRole: 'SELLER',
        tenantRole: 'ACCOUNTING_MANAGER',
      };
      const context = createMockContext(user);

      expect(guard.canActivate(context)).toBe(true);

      const req = getRequest(context);
      expect(req.tenantId).toBe('tenant-456');
      expect(req.isTenantBypassed).toBe(false);
    });

    it('should enforce tenantId for ACCOUNTING_VIEWER role', () => {
      const user = {
        userId: 'user-3',
        email: 'viewer@example.com',
        tenantId: 'tenant-789',
        globalRole: 'SELLER',
        tenantRole: 'ACCOUNTING_VIEWER',
      };
      const context = createMockContext(user);

      expect(guard.canActivate(context)).toBe(true);

      const req = getRequest(context);
      expect(req.tenantId).toBe('tenant-789');
      expect(req.isTenantBypassed).toBe(false);
    });
  });
});
