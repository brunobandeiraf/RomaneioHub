import { IsEnum } from 'class-validator';

export enum SubscriptionPlan {
  MONTHLY = 'monthly',
  ANNUAL = 'annual',
}

export class CreateCheckoutDto {
  @IsEnum(SubscriptionPlan, {
    message: 'plan must be either "monthly" or "annual"',
  })
  plan!: SubscriptionPlan;
}
