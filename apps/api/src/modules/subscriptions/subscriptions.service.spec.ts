import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe.service';
import { PrismaService } from '../../prisma';
import { SubscriptionPlan } from './dto/create-checkout.dto';
import { SubscriptionStatus } from '@compras-hub/shared';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

  const mockPrismaService = {
    tenant: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockStripeService = {
    createCustomer: jest.fn(),
    createCheckoutSession: jest.fn(),
    createPortalSession: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        FRONTEND_URL: 'http://localhost:3000',
        STRIPE_MONTHLY_PRICE_ID: 'price_monthly_test',
        STRIPE_ANNUAL_PRICE_ID: 'price_annual_test',
      };
      return values[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StripeService, useValue: mockStripeService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);

    jest.clearAllMocks();
  });

  describe('createCheckout', () => {
    const tenantId = 'tenant-1';

    it('should create a checkout session for a tenant with existing stripeCustomerId', async () => {
      const mockTenant = {
        id: tenantId,
        stripeCustomerId: 'cus_existing',
        users: [{ user: { email: 'seller@test.com' } }],
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockStripeService.createCheckoutSession.mockResolvedValue({
        id: 'cs_test123',
        url: 'https://checkout.stripe.com/session123',
      });

      const result = await service.createCheckout(tenantId, SubscriptionPlan.MONTHLY);

      expect(result).toEqual({
        sessionId: 'cs_test123',
        url: 'https://checkout.stripe.com/session123',
      });
      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
        'cus_existing',
        'price_monthly_test',
        'http://localhost:3000/settings/subscription?success=true',
        'http://localhost:3000/settings/subscription?cancelled=true',
      );
      // Should NOT create a new customer
      expect(mockStripeService.createCustomer).not.toHaveBeenCalled();
    });

    it('should create a Stripe customer first if tenant has no stripeCustomerId', async () => {
      const mockTenant = {
        id: tenantId,
        name: 'Test Tenant',
        stripeCustomerId: null,
        users: [{ user: { email: 'seller@test.com' } }],
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockStripeService.createCustomer.mockResolvedValue({ id: 'cus_new123' });
      mockPrismaService.tenant.update.mockResolvedValue({
        ...mockTenant,
        stripeCustomerId: 'cus_new123',
      });
      mockStripeService.createCheckoutSession.mockResolvedValue({
        id: 'cs_test456',
        url: 'https://checkout.stripe.com/session456',
      });

      const result = await service.createCheckout(tenantId, SubscriptionPlan.ANNUAL);

      expect(mockStripeService.createCustomer).toHaveBeenCalledWith(
        'seller@test.com',
        'Test Tenant',
      );
      expect(mockPrismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: tenantId },
        data: { stripeCustomerId: 'cus_new123' },
      });
      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
        'cus_new123',
        'price_annual_test',
        'http://localhost:3000/settings/subscription?success=true',
        'http://localhost:3000/settings/subscription?cancelled=true',
      );
      expect(result).toEqual({
        sessionId: 'cs_test456',
        url: 'https://checkout.stripe.com/session456',
      });
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(
        service.createCheckout('nonexistent', SubscriptionPlan.MONTHLY),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use annual price ID for annual plan', async () => {
      const mockTenant = {
        id: tenantId,
        stripeCustomerId: 'cus_existing',
        users: [{ user: { email: 'seller@test.com' } }],
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockStripeService.createCheckoutSession.mockResolvedValue({
        id: 'cs_annual',
        url: 'https://checkout.stripe.com/annual',
      });

      await service.createCheckout(tenantId, SubscriptionPlan.ANNUAL);

      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
        'cus_existing',
        'price_annual_test',
        expect.any(String),
        expect.any(String),
      );
    });

    it('should use monthly price ID for monthly plan', async () => {
      const mockTenant = {
        id: tenantId,
        stripeCustomerId: 'cus_existing',
        users: [{ user: { email: 'seller@test.com' } }],
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockStripeService.createCheckoutSession.mockResolvedValue({
        id: 'cs_monthly',
        url: 'https://checkout.stripe.com/monthly',
      });

      await service.createCheckout(tenantId, SubscriptionPlan.MONTHLY);

      expect(mockStripeService.createCheckoutSession).toHaveBeenCalledWith(
        'cus_existing',
        'price_monthly_test',
        expect.any(String),
        expect.any(String),
      );
    });
  });

  describe('getPortalUrl', () => {
    const tenantId = 'tenant-1';

    it('should return the portal URL for a tenant with stripeCustomerId', async () => {
      const mockTenant = {
        id: tenantId,
        stripeCustomerId: 'cus_existing',
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);
      mockStripeService.createPortalSession.mockResolvedValue({
        url: 'https://billing.stripe.com/portal123',
      });

      const result = await service.getPortalUrl(tenantId);

      expect(result).toEqual({
        url: 'https://billing.stripe.com/portal123',
      });
      expect(mockStripeService.createPortalSession).toHaveBeenCalledWith(
        'cus_existing',
        'http://localhost:3000/settings/subscription',
      );
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(service.getPortalUrl('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when tenant has no stripeCustomerId', async () => {
      const mockTenant = {
        id: tenantId,
        stripeCustomerId: null,
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);

      await expect(service.getPortalUrl(tenantId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getStatus', () => {
    const tenantId = 'tenant-1';

    it('should return current subscription status', async () => {
      const mockTenant = {
        id: tenantId,
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        gracePeriodEnd: null,
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);

      const result = await service.getStatus(tenantId);

      expect(result).toEqual({
        tenantId,
        status: SubscriptionStatus.ACTIVE,
        gracePeriodEnd: null,
      });
    });

    it('should return grace period end date when in GRACE_PERIOD', async () => {
      const gracePeriodEnd = new Date('2025-02-01');
      const mockTenant = {
        id: tenantId,
        subscriptionStatus: SubscriptionStatus.GRACE_PERIOD,
        gracePeriodEnd,
      };

      mockPrismaService.tenant.findUnique.mockResolvedValue(mockTenant);

      const result = await service.getStatus(tenantId);

      expect(result).toEqual({
        tenantId,
        status: SubscriptionStatus.GRACE_PERIOD,
        gracePeriodEnd,
      });
    });

    it('should throw NotFoundException when tenant does not exist', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValue(null);

      await expect(service.getStatus('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
