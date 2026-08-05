import { SetMetadata } from '@nestjs/common';

export const SKIP_SUBSCRIPTION_CHECK_KEY = 'skipSubscriptionCheck';

/**
 * Decorator to bypass the SubscriptionGuard check on specific endpoints.
 * Use for routes that must remain accessible even when subscription is BLOCKED
 * (e.g., checkout, portal, CSV export).
 */
export const SkipSubscriptionCheck = () =>
  SetMetadata(SKIP_SUBSCRIPTION_CHECK_KEY, true);
