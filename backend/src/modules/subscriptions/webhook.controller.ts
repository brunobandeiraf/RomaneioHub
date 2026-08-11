import {
  Controller,
  Post,
  Req,
  Headers,
  Logger,
  HttpCode,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { SkipSubscriptionCheck } from '../../common/decorators/skip-subscription-check.decorator';
import { WebhookService } from './webhook.service';

/**
 * WebhookController handles incoming Stripe webhook HTTP requests.
 * It extracts the raw body for signature validation and delegates
 * event processing to the WebhookService.
 *
 * - Returns 401 on signature validation failure without processing the event.
 * - Returns 200 on successful event processing.
 *
 * @validates Requirements 3.3, 3.4, 3.7, 10.6, 10.7
 */
@Controller('subscriptions')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  /**
   * POST /subscriptions/webhook
   *
   * Stripe webhook endpoint. Validates signature using the raw body,
   * then processes the event. Persists status within 30 seconds of receipt.
   */
  @Post('webhook')
  @Public()
  @SkipThrottle()
  @SkipSubscriptionCheck()
  @HttpCode(200)
  async handleWebhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new UnauthorizedException('Missing stripe-signature header');
    }

    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      this.logger.error('Raw body not available. Ensure rawBody is enabled in NestFactory.');
      throw new UnauthorizedException('Unable to validate webhook signature');
    }

    await this.webhookService.handleWebhookEvent(rawBody, signature);

    return { received: true };
  }
}
