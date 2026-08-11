import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CancellationService } from './cancellation.service';
import { NotificationService } from './notification.service';
import { PrismaService } from '../../prisma';
import { CANCELLATION_GRACE_PERIOD_DAYS, SubscriptionStatus } from '@romaneio-hub/shared';

describe('CancellationService', () => {
  let service: CancellationService;
  let notificationService: NotificationService;

  const mockPrismaService = {
    tenant: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockNotificationService = {
    sendCancellationEmail: jest.fn().mockResolvedValue(undefined),
    sendGracePeriodWarningEmail: jest.fn().mockResolvedValue(undefined),
    sendGracePeriodExpiredEmail: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CancellationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    service = module.get<CancellationService>(CancellationService);
    notificationService = module.get<NotificationService>(NotificationService);

    jest.clearAllMocks();
  });

  describe('handleCancellation', () => {
    it('should set subscription status to GRACE_PERIOD with correct end date', async () => {
      const tenantId = 'tenant-1';
      const mockTenant = {
        id: tenantId,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        users: [{ user: { email: 'seller@test.com' } }],
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrismaService.tenant.update.mockResolvedValue({
        ...mockTenant,
        subscriptionStatus: SubscriptionStatus.GRACE_PERIOD,
      });

      const beforeCall = new Date();
      await service.handleCancellation(tenantId);
      const afterCall = new Date();

      expect(mockPrismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: tenantId },
        data: expect.objectContaining({
          subscriptionStatus: SubscriptionStatus.GRACE_PERIOD,
          gracePeriodEnd: expect.any(Date),
        }),
      });

      // Verify the grace period end date is approximately 30 days from now
      const updateCall = mockPrismaService.tenant.update.mock.calls[0][0];
      const gracePeriodEnd = updateCall.data.gracePeriodEnd as Date;

      const expectedMin = new Date(beforeCall);
      expectedMin.setDate(expectedMin.getDate() + CANCELLATION_GRACE_PERIOD_DAYS);
      const expectedMax = new Date(afterCall);
      expectedMax.setDate(expectedMax.getDate() + CANCELLATION_GRACE_PERIOD_DAYS);

      expect(gracePeriodEnd.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(gracePeriodEnd.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });

    it('should send cancellation notification email', async () => {
      const tenantId = 'tenant-1';
      const email = 'seller@test.com';
      const mockTenant = {
        id: tenantId,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        users: [{ user: { email } }],
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrismaService.tenant.update.mockResolvedValue(mockTenant);

      await service.handleCancellation(tenantId);

      expect(mockNotificationService.sendCancellationEmail).toHaveBeenCalledWith(
        tenantId,
        email,
      );
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(service.handleCancellation('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('handleRenewal', () => {
    it('should restore ACTIVE status and clear gracePeriodEnd during grace period', async () => {
      const tenantId = 'tenant-1';
      const mockTenant = {
        id: tenantId,
        subscriptionStatus: SubscriptionStatus.GRACE_PERIOD,
        gracePeriodEnd: new Date('2025-02-01'),
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockPrismaService.tenant.update.mockResolvedValue({
        ...mockTenant,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        gracePeriodEnd: null,
      });

      await service.handleRenewal(tenantId);

      expect(mockPrismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: tenantId },
        data: {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          gracePeriodEnd: null,
        },
      });
    });

    it('should not update tenant if not in GRACE_PERIOD status', async () => {
      const tenantId = 'tenant-1';
      const mockTenant = {
        id: tenantId,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);

      await service.handleRenewal(tenantId);

      expect(mockPrismaService.tenant.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(service.handleRenewal('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('checkGracePeriodExpiration', () => {
    it('should transition expired tenants to BLOCKED status', async () => {
      const expiredTenants = [
        {
          id: 'tenant-1',
          subscriptionStatus: SubscriptionStatus.GRACE_PERIOD,
          gracePeriodEnd: new Date('2024-01-01'), // expired
          users: [{ user: { email: 'seller1@test.com' } }],
        },
        {
          id: 'tenant-2',
          subscriptionStatus: SubscriptionStatus.GRACE_PERIOD,
          gracePeriodEnd: new Date('2024-01-15'), // expired
          users: [{ user: { email: 'seller2@test.com' } }],
        },
      ];

      mockPrismaService.tenant.findMany.mockResolvedValue(expiredTenants);
      mockPrismaService.tenant.update.mockResolvedValue({});

      const count = await service.checkGracePeriodExpiration();

      expect(count).toBe(2);

      expect(mockPrismaService.tenant.update).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: { subscriptionStatus: SubscriptionStatus.BLOCKED },
      });
      expect(mockPrismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-2' },
        data: { subscriptionStatus: SubscriptionStatus.BLOCKED },
      });
    });

    it('should send expiration notification emails', async () => {
      const expiredTenants = [
        {
          id: 'tenant-1',
          subscriptionStatus: SubscriptionStatus.GRACE_PERIOD,
          gracePeriodEnd: new Date('2024-01-01'),
          users: [{ user: { email: 'seller@test.com' } }],
        },
      ];

      mockPrismaService.tenant.findMany.mockResolvedValue(expiredTenants);
      mockPrismaService.tenant.update.mockResolvedValue({});

      await service.checkGracePeriodExpiration();

      expect(
        mockNotificationService.sendGracePeriodExpiredEmail,
      ).toHaveBeenCalledWith('tenant-1', 'seller@test.com');
    });

    it('should return 0 when no tenants have expired', async () => {
      mockPrismaService.tenant.findMany.mockResolvedValue([]);

      const count = await service.checkGracePeriodExpiration();

      expect(count).toBe(0);
      expect(mockPrismaService.tenant.update).not.toHaveBeenCalled();
    });

    it('should query tenants with correct filters', async () => {
      mockPrismaService.tenant.findMany.mockResolvedValue([]);

      await service.checkGracePeriodExpiration();

      expect(mockPrismaService.tenant.findMany).toHaveBeenCalledWith({
        where: {
          subscriptionStatus: SubscriptionStatus.GRACE_PERIOD,
          gracePeriodEnd: { lt: expect.any(Date) },
        },
        include: {
          users: {
            include: { user: { select: { email: true } } },
            where: { role: 'SELLER' },
            take: 1,
          },
        },
      });
    });
  });

  describe('sendGracePeriodWarnings', () => {
    it('should send warning emails to tenants within 7 days of expiration', async () => {
      const now = new Date();
      const gracePeriodEnd = new Date(now);
      gracePeriodEnd.setDate(now.getDate() + 5); // 5 days remaining

      const warningTenants = [
        {
          id: 'tenant-1',
          subscriptionStatus: SubscriptionStatus.GRACE_PERIOD,
          gracePeriodEnd,
          users: [{ user: { email: 'seller@test.com' } }],
        },
      ];

      mockPrismaService.tenant.findMany.mockResolvedValue(warningTenants);

      const count = await service.sendGracePeriodWarnings();

      expect(count).toBe(1);
      expect(
        mockNotificationService.sendGracePeriodWarningEmail,
      ).toHaveBeenCalledWith('tenant-1', 'seller@test.com', expect.any(Number));

      // Verify days remaining is approximately 5
      const callArgs =
        mockNotificationService.sendGracePeriodWarningEmail.mock.calls[0];
      expect(callArgs[2]).toBeGreaterThanOrEqual(4);
      expect(callArgs[2]).toBeLessThanOrEqual(6);
    });

    it('should return 0 when no tenants need warnings', async () => {
      mockPrismaService.tenant.findMany.mockResolvedValue([]);

      const count = await service.sendGracePeriodWarnings();

      expect(count).toBe(0);
    });
  });
});
