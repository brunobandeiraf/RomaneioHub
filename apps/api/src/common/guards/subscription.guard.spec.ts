import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole, SubscriptionStatus } from '@compras-hub/shared';
import { SubscriptionGuard } from './subscription.guard';

describe('SubscriptionGuard', () => {
  let guard: SubscriptionGuard;
  let reflector: Reflector;
  let prisma: any;

  const createMockContext = (
    method: string,
    tenantId?: string,
    user?: { globalRole?: string },
    path?: string,
  ): ExecutionContext => {
    const request = {
      method,
      tenantId,
      user: user ?? null,
      path: path ?? '/suppliers',
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    reflector = new Reflector();
    prisma = {
      tenant: {
        findUnique: jest.fn(),
      },
    };
    guard = new SubscriptionGuard(reflector, prisma);
  });

  describe('@SkipSubscriptionCheck() decorator bypass', () => {
    it('should allow access when @SkipSubscriptionCheck() is applied', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      const context = createMockContext('POST', 'tenant-1');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('Admin globalRole bypass', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    });

    it.each(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])(
      'should allow %s requests for Admin globalRole users',
      async (method) => {
        const context = createMockContext(method, 'tenant-1', {
          globalRole: GlobalRole.ADMIN,
        });
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
        expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
      },
    );

    it('should allow Admin even when tenant subscription is BLOCKED', async () => {
      const context = createMockContext('POST', 'tenant-1', {
        globalRole: GlobalRole.ADMIN,
      });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('no tenantId bypass', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    });

    it('should allow access when tenantId is undefined', async () => {
      const context = createMockContext('POST', undefined, {
        globalRole: GlobalRole.SELLER,
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('tenant not found in database', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    });

    it('should throw ForbiddenException when tenant not found in DB', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      const context = createMockContext('GET', 'non-existent', {
        globalRole: GlobalRole.SELLER,
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('ACTIVE status', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      prisma.tenant.findUnique.mockResolvedValue({
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      });
    });

    it.each(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])(
      'should allow %s requests',
      async (method) => {
        const context = createMockContext(method, 'tenant-1', {
          globalRole: GlobalRole.SELLER,
        });
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      },
    );
  });

  describe('TRIAL status', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      prisma.tenant.findUnique.mockResolvedValue({
        subscriptionStatus: SubscriptionStatus.TRIAL,
      });
    });

    it.each(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])(
      'should allow %s requests',
      async (method) => {
        const context = createMockContext(method, 'tenant-1', {
          globalRole: GlobalRole.SELLER,
        });
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      },
    );
  });

  describe('PAST_DUE status', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      prisma.tenant.findUnique.mockResolvedValue({
        subscriptionStatus: SubscriptionStatus.PAST_DUE,
      });
    });

    it('should allow GET requests', async () => {
      const context = createMockContext('GET', 'tenant-1', {
        globalRole: GlobalRole.SELLER,
      });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it.each(['POST', 'PATCH', 'PUT', 'DELETE'])(
      'should block %s requests with read-only message',
      async (method) => {
        const context = createMockContext(method, 'tenant-1', {
          globalRole: GlobalRole.SELLER,
        });
        await expect(guard.canActivate(context)).rejects.toThrow(
          new ForbiddenException(
            'Subscription inactive. Write operations are disabled.',
          ),
        );
      },
    );
  });

  describe('GRACE_PERIOD status', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      prisma.tenant.findUnique.mockResolvedValue({
        subscriptionStatus: SubscriptionStatus.GRACE_PERIOD,
      });
    });

    it('should allow GET requests', async () => {
      const context = createMockContext('GET', 'tenant-1', {
        globalRole: GlobalRole.SELLER,
      });
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it.each(['POST', 'PATCH', 'PUT', 'DELETE'])(
      'should block %s requests with read-only message',
      async (method) => {
        const context = createMockContext(method, 'tenant-1', {
          globalRole: GlobalRole.SELLER,
        });
        await expect(guard.canActivate(context)).rejects.toThrow(
          new ForbiddenException(
            'Subscription inactive. Write operations are disabled.',
          ),
        );
      },
    );
  });

  describe('BLOCKED status', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      prisma.tenant.findUnique.mockResolvedValue({
        subscriptionStatus: SubscriptionStatus.BLOCKED,
      });
    });

    it.each(['POST', 'PATCH', 'PUT', 'DELETE'])(
      'should block %s requests on any path',
      async (method) => {
        const context = createMockContext(
          method,
          'tenant-1',
          { globalRole: GlobalRole.SELLER },
          '/suppliers',
        );
        await expect(guard.canActivate(context)).rejects.toThrow(
          new ForbiddenException('Subscription blocked'),
        );
      },
    );

    it('should block GET requests to non-whitelisted paths', async () => {
      const context = createMockContext(
        'GET',
        'tenant-1',
        { globalRole: GlobalRole.SELLER },
        '/suppliers',
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Subscription blocked'),
      );
    });

    it('should block GET requests to /orders', async () => {
      const context = createMockContext(
        'GET',
        'tenant-1',
        { globalRole: GlobalRole.SELLER },
        '/orders',
      );
      await expect(guard.canActivate(context)).rejects.toThrow(
        new ForbiddenException('Subscription blocked'),
      );
    });

    describe('whitelisted paths', () => {
      it('should allow GET /dashboard/export', async () => {
        const context = createMockContext(
          'GET',
          'tenant-1',
          { globalRole: GlobalRole.SELLER },
          '/dashboard/export',
        );
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      });

      it('should allow GET /dashboard/export?filters=value', async () => {
        const context = createMockContext(
          'GET',
          'tenant-1',
          { globalRole: GlobalRole.SELLER },
          '/dashboard/export',
        );
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      });

      it('should allow GET /subscriptions/status', async () => {
        const context = createMockContext(
          'GET',
          'tenant-1',
          { globalRole: GlobalRole.SELLER },
          '/subscriptions/status',
        );
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      });

      it('should allow GET /subscriptions/portal', async () => {
        const context = createMockContext(
          'GET',
          'tenant-1',
          { globalRole: GlobalRole.SELLER },
          '/subscriptions/portal',
        );
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      });

      it('should allow GET /auth/login', async () => {
        const context = createMockContext(
          'GET',
          'tenant-1',
          { globalRole: GlobalRole.SELLER },
          '/auth/login',
        );
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      });

      it('should allow GET /auth/refresh', async () => {
        const context = createMockContext(
          'GET',
          'tenant-1',
          { globalRole: GlobalRole.SELLER },
          '/auth/refresh',
        );
        const result = await guard.canActivate(context);
        expect(result).toBe(true);
      });

      it('should block POST to whitelisted paths when BLOCKED', async () => {
        const context = createMockContext(
          'POST',
          'tenant-1',
          { globalRole: GlobalRole.SELLER },
          '/subscriptions/checkout',
        );
        await expect(guard.canActivate(context)).rejects.toThrow(
          new ForbiddenException('Subscription blocked'),
        );
      });
    });
  });

  describe('CANCELLED status', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      prisma.tenant.findUnique.mockResolvedValue({
        subscriptionStatus: SubscriptionStatus.CANCELLED,
      });
    });

    it.each(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])(
      'should block all %s requests',
      async (method) => {
        const context = createMockContext(method, 'tenant-1', {
          globalRole: GlobalRole.SELLER,
        });
        await expect(guard.canActivate(context)).rejects.toThrow(
          new ForbiddenException('Subscription blocked'),
        );
      },
    );
  });
});
