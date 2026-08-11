import { IsEnum } from 'class-validator';

export enum SubscriptionPlan {
  MONTHLY = 'monthly',
  SEMIANNUAL = 'semiannual',
  ANNUAL = 'annual',
}

export class CreateCheckoutDto {
  @IsEnum(SubscriptionPlan, {
    message: 'planType must be "monthly", "semiannual", or "annual"',
  })
  planType!: SubscriptionPlan;
}
