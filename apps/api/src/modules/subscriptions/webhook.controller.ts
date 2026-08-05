import {
  Controller,
  Post,
  Req,
  Headers,
  Logger,
  HttpCode,
} from '@nestjs/common';
import { Request } from 'express';
import { SubscriptionStatus } from '@compras-hub/shared';
import { Public } from '../../common/decorators/public.decorator';
import { SkipSubscriptionCheck } from '../../common/decorators/skip-subscription-check.decorator';
import { PrismaService } from '../../prisma';
import { StripeService } from './stripe.service';
import { CancellationService } from './cancellation.service';

/**
 * WebhookController handles Stripe webhook events.
 * It validates the Stripe signature and maps events to subscription lifecycle actions.
 *
 * Events handled:
 * - customer.subscription.deleted → handleCancellation (GRACE_PERIOD)
 * - invoice.paid (during GRACE_PERIOD) → handleRenewal (restore ACTIVE)
 * - invoice.payment_failed → transition to PAST_DUE
 *
 * @validates Requirements 3.3, 3.4, 3.7, 10.6, 10.7, 14.1, 14.5
 */
@Controller('subscriptions')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
    private readonly cancellationService: CancellationService,
  ) {}

  /**
   * Stripe webhook endpoint.
   * Validates signature, processes event within 30 seconds.
   */
  @Post('webhook')
  @Public()
  @SkipSubscriptionCheck()
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = (req as any).rawBody || req.body;
    const event = this.stripeService.constructEvent(rawBody, signature);

    this.logger.log(`Received Stripe event: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event);
        break;

      case 'invoice.paid':
        await this.handleInvoicePaid(event);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event);
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }

  /**
   * Handle subscription cancellation from Stripe.
   * Triggers the 30-day grace period flow.
   */
  private async handleSubscriptionDeleted(event: any): Promise<void> {
    const subscription = event.data.object;
    const stripeCustomerId = subscription.customer as string;

    const tenant = await this.findTenantByStripeCustomerId(stripeCustomerId);
    if (!tenant) {
      this.logger.warn(
        `No tenant found for Stripe customer ${stripeCustomerId}`,
      );
      return;
    }

    await this.cancellationService.handleCancellation(tenant.id);
  }

  /**
   * Handle successful invoice payment.
   * If the tenant is in GRACE_PERIOD, this triggers renewal/restoration.
   */
  private async handleInvoicePaid(event: any): Promise<void> {
    const invoice = event.data.object;
    const stripeCustomerId = invoice.customer as string;

    const tenant = await this.findTenantByStripeCustomerId(stripeCustomerId);
    if (!tenant) {
      this.logger.warn(
        `No tenant found for Stripe customer ${stripeCustomerId}`,
      );
      return;
    }

    // If tenant is in GRACE_PERIOD, treat payment as renewal
    if (tenant.subscriptionStatus === SubscriptionStatus.GRACE_PERIOD) {
      await this.cancellationService.handleRenewal(tenant.id);
    } else if (tenant.subscriptionStatus !== SubscriptionStatus.ACTIVE) {
      // For non-active tenants receiving payment, activate them
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          subscriptionStatus: SubscriptionStatus.ACTIVE,
          gracePeriodEnd: null,
        },
      });
      this.logger.log(
        `Tenant ${tenant.id} activated after invoice.paid event.`,
      );
    }
  }

  /**
   * Handle failed payment — transition to PAST_DUE.
   */
  private async handlePaymentFailed(event: any): Promise<void> {
    const invoice = event.data.object;
    const stripeCustomerId = invoice.customer as string;

    const tenant = await this.findTenantByStripeCustomerId(stripeCustomerId);
    if (!tenant) {
      this.logger.warn(
        `No tenant found for Stripe customer ${stripeCustomerId}`,
      );
      return;
    }

    if (tenant.subscriptionStatus === SubscriptionStatus.ACTIVE) {
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          subscriptionStatus: SubscriptionStatus.PAST_DUE,
        },
      });
      this.logger.log(
        `Tenant ${tenant.id} transitioned to PAST_DUE after payment failure.`,
      );
    }
  }

  /**
   * Find a tenant by their Stripe customer ID.
   */
  private async findTenantByStripeCustomerId(stripeCustomerId: string) {
    return this.prisma.tenant.findFirst({
      where: { stripeCustomerId },
      select: {
        id: true,
        subscriptionStatus: true,
      },
    });
  }
}
