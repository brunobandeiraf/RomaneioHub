import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { StripeService } from './stripe.service';
import { PrismaService } from '../../prisma';
import { SubscriptionStatus, GRACE_PERIOD_DAYS } from '@romaneio-hub/shared';
import Stripe from 'stripe';

describe('WebhookService', () => {
  let service: WebhookService;
  let stripeService: { constructEvent: jest.Mock };
  let prismaService: {
    tenant: {
      findFirst: jest.Mock;
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
        findFirst: jest.fn().mockResolvedValue(mockTenant),
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
    it('should return 401 when signature is invalid', async () => {
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

    it('should not process event when signature validation fails', async () => {
      const rawBody = Buffer.from('tampered body');
      const signature = 'bad_sig_123';

      stripeService.constructEvent.mockImplementation(() => {
        throw new UnauthorizedException('Invalid webhook signature');
      });

      await expect(
        service.handleWebhookEvent(rawBody, signature),
      ).rejects.toThrow(UnauthorizedException);

      expect(prismaService.tenant.findFirst).not.toHaveBeenCalled();
      expect(prismaService.tenant.update).not.toHaveBeenCalled();
    });
  });

  describe('checkout.session.completed', () => {
    it('should set ACTIVE status on checkout.session.completed', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_checkout1',
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_test123',
          } as unknown as Stripe.Checkout.Session,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(mockEvent as Stripe.Event);

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.findFirst).toHaveBeenCalledWith({
        where: { stripeCustomerId: 'cus_test123' },
        select: { id: true, subscriptionStatus: true },
      });
      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          gracePeriodEnd: null,
        },
      });
    });

    it('should not update when tenant is not found for checkout session', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      prismaService.tenant.findFirst.mockResolvedValue(null);

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_checkout2',
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_unknown',
          } as unknown as Stripe.Checkout.Session,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(mockEvent as Stripe.Event);

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.update).not.toHaveBeenCalled();
    });
  });

  describe('invoice.paid', () => {
    it('should transition to ACTIVE and clear gracePeriodEnd on invoice.paid', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_paid1',
        type: 'invoice.paid',
        data: {
          object: {
            customer: 'cus_test123',
          } as unknown as Stripe.Invoice,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(mockEvent as Stripe.Event);

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          gracePeriodEnd: null,
        },
      });
    });
  });

  describe('invoice.payment_failed', () => {
    it('should transition to PAST_DUE with grace period on payment failure', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_failed1',
        type: 'invoice.payment_failed',
        data: {
          object: {
            customer: 'cus_test123',
          } as unknown as Stripe.Invoice,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(mockEvent as Stripe.Event);

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
      const expectedMin = new Date(
        beforeCall.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000 - 1000,
      );
      const expectedMax = new Date(
        afterCall.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000 + 1000,
      );
      expect(gracePeriodEnd.getTime()).toBeGreaterThanOrEqual(
        expectedMin.getTime(),
      );
      expect(gracePeriodEnd.getTime()).toBeLessThanOrEqual(
        expectedMax.getTime(),
      );
    });

    it('should not update tenant when customer ID is missing from payment failure', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_failed2',
        type: 'invoice.payment_failed',
        data: {
          object: {
            customer: null,
          } as unknown as Stripe.Invoice,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(mockEvent as Stripe.Event);

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.update).not.toHaveBeenCalled();
    });
  });

  describe('customer.subscription.updated', () => {
    it('should map active status to ACTIVE', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_updated1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_test123',
            status: 'active',
          } as unknown as Stripe.Subscription,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(mockEvent as Stripe.Event);

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          gracePeriodEnd: null,
        },
      });
    });

    it('should map past_due status to PAST_DUE with grace period', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_updated2',
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_test123',
            status: 'past_due',
          } as unknown as Stripe.Subscription,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(mockEvent as Stripe.Event);

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          subscriptionStatus: SubscriptionStatus.PAST_DUE,
          gracePeriodEnd: expect.any(Date),
        },
      });
    });

    it('should map canceled status to CANCELLED', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_updated3',
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_test123',
            status: 'canceled',
          } as unknown as Stripe.Subscription,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(mockEvent as Stripe.Event);

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          subscriptionStatus: SubscriptionStatus.CANCELLED,
          gracePeriodEnd: null,
        },
      });
    });

    it('should map trialing status to TRIAL', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_updated4',
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_test123',
            status: 'trialing',
          } as unknown as Stripe.Subscription,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(mockEvent as Stripe.Event);

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          subscriptionStatus: SubscriptionStatus.TRIAL,
          gracePeriodEnd: null,
        },
      });
    });

    it('should not update tenant when customer ID is not found in database', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      prismaService.tenant.findFirst.mockResolvedValue(null);

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_updated5',
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_unknown',
            status: 'active',
          } as unknown as Stripe.Subscription,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(mockEvent as Stripe.Event);

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.update).not.toHaveBeenCalled();
    });
  });

  describe('customer.subscription.deleted', () => {
    it('should transition to CANCELLED on subscription deletion', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_deleted1',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            customer: 'cus_test123',
            status: 'canceled',
          } as unknown as Stripe.Subscription,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(mockEvent as Stripe.Event);

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.update).toHaveBeenCalledWith({
        where: { id: 'tenant-1' },
        data: {
          subscriptionStatus: SubscriptionStatus.CANCELLED,
          gracePeriodEnd: null,
        },
      });
    });
  });

  describe('unhandled events', () => {
    it('should not update tenant for unhandled event types', async () => {
      const rawBody = Buffer.from('valid body');
      const signature = 'valid_sig';

      const mockEvent: Partial<Stripe.Event> = {
        id: 'evt_other1',
        type: 'payment_intent.succeeded',
        data: {
          object: {} as any,
          previous_attributes: {},
        },
      };

      stripeService.constructEvent.mockReturnValue(mockEvent as Stripe.Event);

      await service.handleWebhookEvent(rawBody, signature);

      expect(prismaService.tenant.update).not.toHaveBeenCalled();
    });
  });
});
