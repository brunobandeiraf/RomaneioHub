import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  function createMockContext(
    headers: Record<string, string | undefined> = {},
    user?: any,
    isPublic = false,
  ): ExecutionContext {
    const request = { headers, user } as any;

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
    it('should allow access on public routes without headers', () => {
      const context = createMockContext({}, undefined, true);
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe('when request.user is already set', () => {
    it('should pass through without modifying user', () => {
      const existingUser = { id: 'existing', email: 'a@b.com', tenantId: 't1' };
      const context = createMockContext({}, existingUser);

      expect(guard.canActivate(context)).toBe(true);

      const req = getRequest(context);
      expect(req.user).toBe(existingUser);
    });
  });

  describe('development mode (header-based auth)', () => {
    it('should set request.user from headers', () => {
      const context = createMockContext({
        'x-user-id': 'user-1',
        'x-user-email': 'test@example.com',
        'x-tenant-id': 'tenant-abc',
        'x-global-role': 'SELLER',
        'x-tenant-role': 'SELLER',
      });

      expect(guard.canActivate(context)).toBe(true);

      const req = getRequest(context);
      expect(req.user).toEqual({
        userId: 'user-1',
        email: 'test@example.com',
        tenantId: 'tenant-abc',
        globalRole: 'SELLER',
        tenantRole: 'SELLER',
      });
    });

    it('should set globalRole to SELLER by default', () => {
      const context = createMockContext({
        'x-user-id': 'user-1',
        'x-user-email': 'test@example.com',
        'x-tenant-id': 'tenant-abc',
      });

      expect(guard.canActivate(context)).toBe(true);

      const req = getRequest(context);
      expect(req.user.globalRole).toBe('SELLER');
    });

    it('should set tenantId to undefined when header is missing', () => {
      const context = createMockContext({
        'x-user-id': 'admin-1',
        'x-user-email': 'admin@example.com',
        'x-global-role': 'ADMIN',
      });

      expect(guard.canActivate(context)).toBe(true);

      const req = getRequest(context);
      expect(req.user.tenantId).toBeUndefined();
    });

    it('should throw UnauthorizedException when x-user-id is missing', () => {
      const context = createMockContext({
        'x-user-email': 'test@example.com',
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when x-user-email is missing', () => {
      const context = createMockContext({
        'x-user-id': 'user-1',
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when no auth headers are present', () => {
      const context = createMockContext({});

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });
});
