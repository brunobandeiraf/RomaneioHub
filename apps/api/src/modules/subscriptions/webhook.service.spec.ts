import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { StripeService } from './stripe.service';
import { PrismaService } from '../../prisma';
import { SubscriptionStatus } from '@compras-hub/shared';
import Stripe from 'stripe';

describe('WebhookService', () => {
  let service: WebhookService;
  let stripeService: { constructEvent: jest.Mock };
  let prismaService: {
    tenant: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  const mockTenant = {
    id: 'tenant-1',
    stripeCustomerId: 'cus_test123',
    subscriptionStatus: SubscriptionStatus.ACTIVE,
    gracePeriodEnd: null,
  };

  beforeEach(async () => {
    stripeService = {
      constructEvent: jest.fn(),
    };

    prismaService = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(mockTenant),
        update: jest.fn().mockResolvedValue(mockTenant),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: StripeService, useValue: stripeService },
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
  });

  describe('handleWebhookEvent', () => {
    it('should reject invalid signature with UnauthorizedException', async () => {
      const rawBody = Buffer.from('invalid body');
      const signature = 'invalid_sig';

      stripeService.constructEvent.mockImplementation(() => {
        throw new UnauthorizedException('Invalid webhook signature');
      });

      await expect(
        service.handleWebhookEvent(rawBody, signature),
      ).rejects.toThrow(UnauthorizedException);

      // Verify no tenant update was attempted
      expect(prismaService.tenant.update).not.toHaveBeenCalled();
    });

    it('should process customer.subscription.updated with active status', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_test1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_test123',
            status: 'active',
          } as unknown as Stripe.Subscription,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(
        mockEvent as Stripe.Event,
      );

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.findUnique).toHaveBeenCalledWith({
        where: { stripeCustomerId: 'cus_test123' },
      });
      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          gracePeriodEnd: null,
        },
      });
    });

    it('should transition to PAST_DUE on payment failure with grace period', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_test2',
        type: 'invoice.payment_failed',
        data: {
          object: {
            customer: 'cus_test123',
          } as unknown as Stripe.Invoice,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(
        mockEvent as Stripe.Event,
      );

      const beforeCall = new Date();
      await service.handleWebhookEvent(rawBody, signature);
      const afterCall = new Date();

      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          subscriptionStatus: SubscriptionStatus.PAST_DUE,
          gracePeriodEnd: expect.any(Date),
        },
      });

      // Verify grace period is ~7 days from now
      const updateCall = prismaService.tenant.update.mock.calls[0][0];
      const gracePeriodEnd = updateCall.data.gracePeriodEnd as Date;
      const expectedMin = new Date(beforeCall.getTime() + 7 * 24 * 60 * 60 * 1000 - 1000);
      const expectedMax = new Date(afterCall.getTime() + 7 * 24 * 60 * 60 * 1000 + 1000);
      expect(gracePeriodEnd.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime());
      expect(gracePeriodEnd.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
    });

    it('should transition to CANCELLED on subscription deletion', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_test3',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            customer: 'cus_test123',
            status: 'canceled',
          } as unknown as Stripe.Subscription,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(
        mockEvent as Stripe.Event,
      );

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          subscriptionStatus: SubscriptionStatus.CANCELLED,
          gracePeriodEnd: null,
        },
      });
    });

    it('should transition to ACTIVE and clear gracePeriodEnd on invoice.paid', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_test4',
        type: 'invoice.paid',
        data: {
          object: {
            customer: 'cus_test123',
          } as unknown as Stripe.Invoice,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(
        mockEvent as Stripe.Event,
      );

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          gracePeriodEnd: null,
        },
      });
    });

    it('should handle customer.subscription.created with trialing status as TRIAL', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_test5',
        type: 'customer.subscription.created',
        data: {
          object: {
            customer: 'cus_test123',
            status: 'trialing',
          } as unknown as Stripe.Subscription,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(
        mockEvent as Stripe.Event,
      );

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          subscriptionStatus: SubscriptionStatus.TRIAL,
          gracePeriodEnd: null,
        },
      });
    });

    it('should not update tenant when customer ID not found in database', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      prismaService.tenant.findUnique.mockResolvedValue(null);

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_test6',
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_unknown',
            status: 'active',
          } as unknown as Stripe.Subscription,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(
        mockEvent as Stripe.Event,
      );

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.update).not.toHaveBeenCalled();
    });

    it('should handle subscription.updated with past_due and set grace period', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_test7',
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_test123',
            status: 'past_due',
          } as unknown as Stripe.Subscription,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(
        mockEvent as Stripe.Event,
      );

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          subscriptionStatus: SubscriptionStatus.PAST_DUE,
          gracePeriodEnd: expect.any(Date),
        },
      });
    });
  });
});
