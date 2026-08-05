import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole, TenantRole } from '@compras-hub/shared';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockContext(user: any) {
    return {
      getHandler: () => jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  }

  it('should allow access when no roles are required', () => {
    jest.spyOn(reflector, 'get').mockReturnValue(undefined);

    const context = createMockContext({ tenantRole: TenantRole.SELLER });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when roles array is empty', () => {
    jest.spyOn(reflector, 'get').mockReturnValue([]);

    const context = createMockContext({ tenantRole: TenantRole.SELLER });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when user has a required role', () => {
    jest
      .spyOn(reflector, 'get')
      .mockReturnValue([TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER]);

    const context = createMockContext({ tenantRole: TenantRole.SELLER });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow Accounting_Manager when role is required', () => {
    jest
      .spyOn(reflector, 'get')
      .mockReturnValue([TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER]);

    const context = createMockContext({
      tenantRole: TenantRole.ACCOUNTING_MANAGER,
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw ForbiddenException when user role is not in required roles', () => {
    jest
      .spyOn(reflector, 'get')
      .mockReturnValue([TenantRole.SELLER, TenantRole.ACCOUNTING_MANAGER]);

    const context = createMockContext({
      tenantRole: TenantRole.ACCOUNTING_VIEWER,
      globalRole: GlobalRole.SELLER,
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException with generic "Forbidden" message (no resource details)', () => {
    jest.spyOn(reflector, 'get').mockReturnValue([TenantRole.SELLER]);

    const context = createMockContext({
      tenantRole: TenantRole.ACCOUNTING_VIEWER,
      globalRole: GlobalRole.SELLER,
    });

    try {
      guard.canActivate(context);
      fail('Expected ForbiddenException');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect((e as ForbiddenException).message).toBe('Forbidden');
    }
  });

  it('should throw ForbiddenException when user object is missing', () => {
    jest.spyOn(reflector, 'get').mockReturnValue([TenantRole.SELLER]);

    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when user has no tenantRole', () => {
    jest.spyOn(reflector, 'get').mockReturnValue([TenantRole.SELLER]);

    const context = createMockContext({
      email: 'user@example.com',
      globalRole: GlobalRole.SELLER,
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should read roles from handler metadata using ROLES_KEY', () => {
    const getSpy = jest
      .spyOn(reflector, 'get')
      .mockReturnValue([TenantRole.SELLER]);
    const handler = jest.fn();
    const context = {
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({ user: { tenantRole: TenantRole.SELLER } }),
      }),
    } as any;

    guard.canActivate(context);

    expect(getSpy).toHaveBeenCalledWith(ROLES_KEY, handler);
  });

  describe('Admin bypass', () => {
    it('should allow access for ADMIN globalRole even without matching tenantRole', () => {
      jest.spyOn(reflector, 'get').mockReturnValue([TenantRole.SELLER]);

      const context = createMockContext({
        globalRole: GlobalRole.ADMIN,
        tenantRole: TenantRole.ACCOUNTING_VIEWER,
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access for ADMIN globalRole even without any tenantRole', () => {
      jest.spyOn(reflector, 'get').mockReturnValue([TenantRole.SELLER]);

      const context = createMockContext({
        globalRole: GlobalRole.ADMIN,
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('should allow access for ADMIN on any restricted endpoint', () => {
      jest.spyOn(reflector, 'get').mockReturnValue([
        TenantRole.SELLER,
        TenantRole.ACCOUNTING_MANAGER,
      ]);

      const context = createMockContext({
        globalRole: GlobalRole.ADMIN,
        tenantRole: TenantRole.ACCOUNTING_VIEWER,
      });
      expect(guard.canActivate(context)).toBe(true);
    });
  });
});
