import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma';
import { StripeService } from './stripe.service';
import { SubscriptionPlan } from './dto/create-checkout.dto';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Creates a Stripe Checkout session for the given tenant.
   * If tenant doesn't have a stripeCustomerId, creates one first.
   */
  async createCheckout(tenantId: string, plan: SubscriptionPlan) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          include: { user: true },
          where: { role: 'SELLER' },
          take: 1,
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    let stripeCustomerId = tenant.stripeCustomerId;

    // Create Stripe customer if doesn't exist yet
    if (!stripeCustomerId) {
      const sellerUser = tenant.users[0]?.user;
      const customer = await this.stripeService.createCustomer(
        sellerUser?.email || `tenant-${tenantId}@compras-hub.com`,
        tenant.name,
      );
      stripeCustomerId = customer.id;

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeCustomerId },
      });

      this.logger.log(
        `Created Stripe customer ${stripeCustomerId} for tenant ${tenantId}`,
      );
    }

    const priceId = this.getPriceId(plan);
    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const successUrl = `${frontendUrl}/settings/subscription?success=true`;
    const cancelUrl = `${frontendUrl}/settings/subscription?cancelled=true`;

    const session = await this.stripeService.createCheckoutSession(
      stripeCustomerId,
      priceId,
      successUrl,
      cancelUrl,
    );

    return { sessionId: session.id, url: session.url };
  }

  /**
   * Generates a Stripe Customer Portal URL for the tenant.
   */
  async getPortalUrl(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (!tenant.stripeCustomerId) {
      throw new NotFoundException(
        'No Stripe customer found. Please complete a checkout first.',
      );
    }

    const frontendUrl = this.configService.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const returnUrl = `${frontendUrl}/settings/subscription`;

    const session = await this.stripeService.createPortalSession(
      tenant.stripeCustomerId,
      returnUrl,
    );

    return { url: session.url };
  }

  /**
   * Returns the current subscription status for the tenant.
   */
  async getStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        subscriptionStatus: true,
        gracePeriodEnd: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      tenantId: tenant.id,
      status: tenant.subscriptionStatus,
      gracePeriodEnd: tenant.gracePeriodEnd,
    };
  }

  /**
   * Resolves the Stripe Price ID for the given plan from environment variables.
   */
  private getPriceId(plan: SubscriptionPlan): string {
    if (plan === SubscriptionPlan.MONTHLY) {
      return this.configService.get<string>(
        'STRIPE_MONTHLY_PRICE_ID',
        'price_monthly_placeholder',
      );
    }
    return this.configService.get<string>(
      'STRIPE_ANNUAL_PRICE_ID',
      'price_annual_placeholder',
    );
  }
}
