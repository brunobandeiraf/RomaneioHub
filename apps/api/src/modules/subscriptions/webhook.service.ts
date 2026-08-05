import { Injectable, Logger } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma';
import { StripeService } from './stripe.service';
import { CancellationService } from './cancellation.service';
import { SubscriptionStatus } from '@compras-hub/shared';
import { GRACE_PERIOD_DAYS } from '@compras-hub/shared';

/**
 * Service responsible for processing Stripe webhook events and
 * synchronizing subscription status with the tenant record.
 *
 * Event-to-status mapping:
 * - customer.subscription.created → ACTIVE (or TRIAL if trialing)
 * - customer.subscription.updated → ACTIVE or PAST_DUE depending on status
 * - customer.subscription.deleted → GRACE_PERIOD (30-day cancellation grace period)
 * - invoice.payment_failed → PAST_DUE (sets gracePeriodEnd = now + 7 days)
 * - invoice.paid → ACTIVE (clears gracePeriodEnd); if in GRACE_PERIOD, triggers renewal
 *
 * @validates Requirements 3.3, 3.4, 3.7, 10.6, 10.7, 14.1, 14.5
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly cancellationService: CancellationService,
  ) {}

  /**
   * Validates the webhook signature and processes the event.
   * Returns void on success. Throws UnauthorizedException on invalid signature.
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
      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(
          event.data.object as Stripe.Subscription,
        );
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
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.paid':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  /**
   * customer.subscription.created → ACTIVE (or keep TRIAL if trialing)
   */
  private async handleSubscriptionCreated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    const newStatus =
      subscription.status === 'trialing'
        ? SubscriptionStatus.TRIAL
        : SubscriptionStatus.ACTIVE;

    await this.updateTenantStatus(customerId, newStatus, null);
    this.logger.log(
      `Subscription created for customer ${customerId} → ${newStatus}`,
    );
  }

  /**
   * customer.subscription.updated → ACTIVE or PAST_DUE depending on Stripe status
   */
  private async handleSubscriptionUpdated(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

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
      case 'trialing':
        newStatus = SubscriptionStatus.TRIAL;
        break;
      case 'canceled':
      case 'unpaid':
        newStatus = SubscriptionStatus.CANCELLED;
        break;
      default:
        this.logger.warn(
          `Unknown subscription status: ${subscription.status}`,
        );
        return;
    }

    await this.updateTenantStatus(customerId, newStatus, gracePeriodEnd);
    this.logger.log(
      `Subscription updated for customer ${customerId} → ${newStatus}`,
    );
  }

  /**
   * customer.subscription.deleted → GRACE_PERIOD (30-day cancellation grace period)
   * Uses CancellationService to handle the transition and send notifications.
   *
   * @validates Requirements 14.1, 14.2
   */
  private async handleSubscriptionDeleted(
    subscription: Stripe.Subscription,
  ): Promise<void> {
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer.id;

    const tenant = await this.prisma.tenant.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!tenant) {
      this.logger.warn(
        `No tenant found for Stripe customer ${customerId}`,
      );
      return;
    }

    await this.cancellationService.handleCancellation(tenant.id);
    this.logger.log(
      `Subscription deleted for customer ${customerId} → GRACE_PERIOD (30-day cancellation)`,
    );
  }

  /**
   * invoice.payment_failed → PAST_DUE (set gracePeriodEnd = now + 7 days)
   */
  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

    if (!customerId) {
      this.logger.warn('Payment failed event missing customer ID');
      return;
    }

    const gracePeriodEnd = this.calculateGracePeriodEnd();
    await this.updateTenantStatus(
      customerId,
      SubscriptionStatus.PAST_DUE,
      gracePeriodEnd,
    );
    this.logger.log(
      `Payment failed for customer ${customerId} → PAST_DUE (grace until ${gracePeriodEnd.toISOString()})`,
    );
  }

  /**
   * invoice.paid → ACTIVE (clear gracePeriodEnd)
   * If tenant is in GRACE_PERIOD, triggers renewal via CancellationService.
   *
   * @validates Requirement 14.5
   */
  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

    if (!customerId) {
      this.logger.warn('Payment succeeded event missing customer ID');
      return;
    }

    // Check if tenant is in grace period — if so, use CancellationService for renewal
    const tenant = await this.prisma.tenant.findUnique({
      where: { stripeCustomerId: customerId },
    });

    if (!tenant) {
      this.logger.warn(
        `No tenant found for Stripe customer ${customerId}`,
      );
      return;
    }

    if (tenant.subscriptionStatus === SubscriptionStatus.GRACE_PERIOD) {
      await this.cancellationService.handleRenewal(tenant.id);
      this.logger.log(
        `Payment succeeded for customer ${customerId} → renewed from GRACE_PERIOD to ACTIVE`,
      );
    } else {
      await this.updateTenantStatus(customerId, SubscriptionStatus.ACTIVE, null);
      this.logger.log(
        `Payment succeeded for customer ${customerId} → ACTIVE`,
      );
    }
  }

  /**
   * Updates the tenant subscription status by Stripe customer ID.
   */
  private async updateTenantStatus(
    stripeCustomerId: string,
    status: SubscriptionStatus,
    gracePeriodEnd: Date | null,
  ): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { stripeCustomerId },
    });

    if (!tenant) {
      this.logger.warn(
        `No tenant found for Stripe customer ${stripeCustomerId}`,
      );
      return;
    }

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionStatus: status,
        gracePeriodEnd,
      },
    });
  }

  /**
   * Calculates the grace period end date (now + GRACE_PERIOD_DAYS).
   */
  private calculateGracePeriodEnd(): Date {
    const end = new Date();
    end.setDate(end.getDate() + GRACE_PERIOD_DAYS);
    return end;
  }
}
