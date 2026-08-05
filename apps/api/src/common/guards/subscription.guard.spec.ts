import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionStatus } from '@compras-hub/shared';
import { SubscriptionGuard } from './subscription.guard';

describe('SubscriptionGuard', () => {
  let guard: SubscriptionGuard;
  let reflector: Reflector;
  let prisma: any;

  const createMockContext = (
    method: string,
    tenantId?: string,
  ): ExecutionContext => {
    const request = { method, tenantId };
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

  describe('skip subscription check decorator', () => {
    it('should allow access when @SkipSubscriptionCheck() is applied', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      const context = createMockContext('POST', 'tenant-1');

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(prisma.tenant.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('missing tenant', () => {
    beforeEach(() => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    });

    it('should throw ForbiddenException when tenantId is missing', async () => {
      const context = createMockContext('GET', undefined);

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException when tenant not found in DB', async () => {
      prisma.tenant.findUnique.mockResolvedValue(null);
      const context = createMockContext('GET', 'non-existent');

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
        const context = createMockContext(method, 'tenant-1');
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
        const context = createMockContext(method, 'tenant-1');
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
      const context = createMockContext('GET', 'tenant-1');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it.each(['POST', 'PATCH', 'PUT', 'DELETE'])(
      'should block %s requests with read-only message',
      async (method) => {
        const context = createMockContext(method, 'tenant-1');
        await expect(guard.canActivate(context)).rejects.toThrow(
          new ForbiddenException('Subscription inactive - read-only mode'),
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
      const context = createMockContext('GET', 'tenant-1');
      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it.each(['POST', 'PATCH', 'PUT', 'DELETE'])(
      'should block %s requests with read-only message',
      async (method) => {
        const context = createMockContext(method, 'tenant-1');
        await expect(guard.canActivate(context)).rejects.toThrow(
          new ForbiddenException('Subscription inactive - read-only mode'),
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

    it.each(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])(
      'should block all %s requests',
      async (method) => {
        const context = createMockContext(method, 'tenant-1');
        await expect(guard.canActivate(context)).rejects.toThrow(
          new ForbiddenException('Subscription blocked'),
        );
      },
    );
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
        const context = createMockContext(method, 'tenant-1');
        await expect(guard.canActivate(context)).rejects.toThrow(
          new ForbiddenException('Subscription blocked'),
        );
      },
    );
  });
});
