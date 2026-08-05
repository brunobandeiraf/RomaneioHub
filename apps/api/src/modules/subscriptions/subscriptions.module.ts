import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { StripeService } from './stripe.service';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { CancellationService } from './cancellation.service';
import { NotificationService } from './notification.service';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionsController, WebhookController],
  providers: [
    SubscriptionsService,
    StripeService,
    WebhookService,
    CancellationService,
    NotificationService,
  ],
  exports: [SubscriptionsService, StripeService, CancellationService],
})
export class SubscriptionsModule {}
