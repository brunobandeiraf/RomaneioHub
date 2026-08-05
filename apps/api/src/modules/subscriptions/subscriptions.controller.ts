import { Controller, Post, Get, Body } from '@nestjs/common';
import { TenantRole } from '@compras-hub/shared';
import { Roles, CurrentUser, SkipSubscriptionCheck } from '../../common/decorators';
import { RequestUser } from '../../common/interfaces';
import { SubscriptionsService } from './subscriptions.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * Create a Stripe Checkout session for monthly or annual plan.
   * Accessible even when subscription is blocked.
   */
  @Post('checkout')
  @Roles(TenantRole.SELLER)
  @SkipSubscriptionCheck()
  async createCheckout(
    @Body() dto: CreateCheckoutDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.subscriptionsService.createCheckout(user.tenantId, dto.plan);
  }

  /**
   * Generate a Stripe Customer Portal URL for subscription management.
   * Accessible even when subscription is blocked.
   */
  @Get('portal')
  @Roles(TenantRole.SELLER)
  @SkipSubscriptionCheck()
  async getPortal(@CurrentUser() user: RequestUser) {
    return this.subscriptionsService.getPortalUrl(user.tenantId);
  }

  /**
   * Return current subscription status from the database.
   * Accessible even when subscription is blocked.
   */
  @Get('status')
  @Roles(TenantRole.SELLER)
  @SkipSubscriptionCheck()
  async getStatus(@CurrentUser() user: RequestUser) {
    return this.subscriptionsService.getStatus(user.tenantId);
  }
}
