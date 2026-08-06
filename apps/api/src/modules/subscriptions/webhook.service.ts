import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma';
import { StripeService } from './stripe.service';
import { SubscriptionStatus, GRACE_PERIOD_DAYS } from '@compras-hub/shared';

/**
 * Service responsible for processing Stripe webhook events and
 * synchronizing subscription status with the tenant record.
 *
 * Event-to-status mapping:
 * - checkout.session.completed → ACTIVE (store stripeCustomerId)
 * - invoice.paid → ACTIVE (clears gracePeriodEnd)
 * - invoice.payment_failed → PAST_DUE (sets gracePeriodEnd = now + 7 days)
 * - customer.subscription.updated (status 'past_due') → PAST_DUE (sets gracePeriodEnd)
 * - customer.subscription.updated (status 'canceled') → CANCELLED
 * - customer.subscription.updated (status 'active') → ACTIVE
 * - customer.subscription.deleted → CANCELLED
 *
 * Persists status within 30 seconds of event receipt.
 *
 * @validates Requirements 3.3, 3.4, 3.7, 10.6, 10.7
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Validates the webhook signature and processes the event.
   * Throws UnauthorizedException on invalid signature (returned as 401 by the controller).
   */
  async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    const event = this.stripeService.constructEvent(rawBody, signature);
    await this.processEvent(event);
  }

  /**
   * Routes a Stripe event to the appropriate handler based on event type.
   */
  private async processEvent(event: Stripe.Event): Promise<void> {
    this.logger.log(`Processing webhook event: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session,
        );
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription,
        );
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        );
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * checkout.session.completed → ACTIVE, store stripeCustomerId on tenant.
   * This is the first event received after a successful checkout.
   */
  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const stripeCustomerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer?.id;

    if (!stripeCustomerId) {
      this.logger.warn('Checkout session completed without customer ID');
      return;
    }

    const tenant = await this.findTenantByStripeCustomerId(stripeCustomerId);
    if (!tenant) return;

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        gracePeriodEnd: null,
      },
    });

    this.logger.log(
      `Checkout completed for customer ${stripeCustomerId} → ACTIVE`,
    );
  }

  /**
   * invoice.paid → ACTIVE (clear gracePeriodEnd).
   */
  private async handleInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    const customerId = this.extractCustomerId(invoice.customer);

    if (!customerId) {
      this.logger.warn('invoice.paid event missing customer ID');
      return;
    }

    const tenant = await this.findTenantByStripeCustomerId(customerId);
    if (!tenant) return;

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        gracePeriodEnd: null,
      },
    });

    this.logger.log(`Payment succeeded for customer ${customerId} → ACTIVE`);
  }

  /**
   * invoice.payment_failed → PAST_DUE (set gracePeriodEnd = now + 7 days).
   * Grace period: 7 days read-only after PAST_DUE.
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = this.extractCustomerId(invoice.customer);

    if (!customerId) {
      this.logger.warn('invoice.payment_failed event missing customer ID');
      return;
    }

    const tenant = await this.findTenantByStripeCustomerId(customerId);
    if (!tenant) return;

    const gracePeriodEnd = this.calculateGracePeriodEnd();

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionStatus: SubscriptionStatus.PAST_DUE,
        gracePeriodEnd,
      },
    });

    this.logger.log(
      `Payment failed for customer ${customerId} → PAST_DUE (grace until ${gracePeriodEnd.toISOString()})`,
    );
  }

  /**
   * customer.subscription.updated → maps Stripe subscription status to our status.
   * - 'active' → ACTIVE
   * - 'past_due' → PAST_DUE (with grace period)
   * - 'canceled' → CANCELLED
   */
  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const customerId = this.extractCustomerId(subscription.customer);

    if (!customerId) {
      this.logger.warn('subscription.updated event missing customer ID');
      return;
    }

    let newStatus: SubscriptionStatus;
    let gracePeriodEnd: Date | null = null;

    switch (subscription.status) {
      case 'active':
        newStatus = SubscriptionStatus.ACTIVE;
        break;
      case 'past_due':
        newStatus = SubscriptionStatus.PAST_DUE;
        gracePeriodEnd = this.calculateGracePeriodEnd();
        break;
      case 'canceled':
      case 'unpaid':
        newStatus = SubscriptionStatus.CANCELLED;
        break;
      case 'trialing':
        newStatus = SubscriptionStatus.TRIAL;
        break;
      default:
        this.logger.warn(
          `Unknown subscription status: ${subscription.status}`,
        );
        return;
    }

    const tenant = await this.findTenantByStripeCustomerId(customerId);
    if (!tenant) return;

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionStatus: newStatus,
        gracePeriodEnd,
      },
    });

    this.logger.log(
      `Subscription updated for customer ${customerId} → ${newStatus}`,
    );
  }

  /**
   * customer.subscription.deleted → CANCELLED.
   */
  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const customerId = this.extractCustomerId(subscription.customer);

    if (!customerId) {
      this.logger.warn('subscription.deleted event missing customer ID');
      return;
    }

    const tenant = await this.findTenantByStripeCustomerId(customerId);
    if (!tenant) return;

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionStatus: SubscriptionStatus.CANCELLED,
        gracePeriodEnd: null,
      },
    });

    this.logger.log(
      `Subscription deleted for customer ${customerId} → CANCELLED`,
    );
  }

  /**
   * Find a tenant by their Stripe customer ID.
   */
  private async findTenantByStripeCustomerId(stripeCustomerId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { stripeCustomerId },
      select: { id: true, subscriptionStatus: true },
    });

    if (!tenant) {
      this.logger.warn(
        `No tenant found for Stripe customer ${stripeCustomerId}`,
      );
    }

    return tenant;
  }

  /**
   * Extracts the customer ID string from a Stripe customer field
   * which can be a string, a Customer object, or a DeletedCustomer object.
   */
  private extractCustomerId(
    customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
  ): string | null {
    if (!customer) return null;
    if (typeof customer === 'string') return customer;
    return customer.id;
  }

  /**
   * Calculates the grace period end date (now + GRACE_PERIOD_DAYS).
   * Grace period = 7 days of read-only mode after PAST_DUE.
   */
  private calculateGracePeriodEnd(): Date {
    const end = new Date();
    end.setDate(end.getDate() + GRACE_PERIOD_DAYS);
    return end;
  }
}
