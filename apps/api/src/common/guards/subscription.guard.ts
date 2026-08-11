import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole, SubscriptionStatus } from '@romaneio-hub/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { SKIP_SUBSCRIPTION_CHECK_KEY } from '../decorators/skip-subscription-check.decorator';

/**
 * Paths that remain accessible even when subscription is BLOCKED.
 * These are GET-only endpoints for data export, subscription management,
 * and authentication.
 */
const BLOCKED_WHITELIST_PATTERNS: RegExp[] = [
  /^\/dashboard\/export/,
  /^\/subscriptions(\/|$)/,
  /^\/auth(\/|$)/,
];

/**
 * SubscriptionGuard enforces subscription-based access control:
 *
 * - ACTIVE / TRIAL: all operations allowed
 * - PAST_DUE / GRACE_PERIOD: read (GET) allowed, writes (POST/PATCH/PUT/DELETE) blocked
 * - BLOCKED: all operations blocked except whitelisted GET paths (CSV export, subscriptions, auth)
 * - CANCELLED: all operations blocked
 *
 * Bypass conditions:
 * - Route decorated with @SkipSubscriptionCheck()
 * - User has Admin globalRole
 * - No tenantId on request (public or system-level routes)
 *
 * @validates Requirements 3.5, 3.6, 14.2
 */
@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check @SkipSubscriptionCheck() decorator
    const skipCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_SUBSCRIPTION_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Admin users bypass subscription check entirely
    if (request.user?.globalRole === GlobalRole.ADMIN) {
      return true;
    }

    const tenantId: string | undefined = request.tenantId;

    // No tenantId means no subscription to check (public/system routes)
    if (!tenantId) {
      return true;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscriptionStatus: true },
    });

    if (!tenant) {
      throw new ForbiddenException('Subscription blocked');
    }

    const status = tenant.subscriptionStatus as SubscriptionStatus;
    const method = request.method as string;
    const path: string = request.path || request.url || '';

    // ACTIVE or TRIAL: allow all operations
    if (
      status === SubscriptionStatus.ACTIVE ||
      status === SubscriptionStatus.TRIAL
    ) {
      return true;
    }

    // BLOCKED: block all operations except whitelisted GET paths
    if (status === SubscriptionStatus.BLOCKED) {
      if (method === 'GET' && this.isWhitelistedPath(path)) {
        return true;
      }
      throw new ForbiddenException('Subscription blocked');
    }

    // CANCELLED: block all operations
    if (status === SubscriptionStatus.CANCELLED) {
      throw new ForbiddenException('Subscription blocked');
    }

    // PAST_DUE or GRACE_PERIOD: allow reads, block writes
    if (
      status === SubscriptionStatus.PAST_DUE ||
      status === SubscriptionStatus.GRACE_PERIOD
    ) {
      if (method === 'GET') {
        return true;
      }
      throw new ForbiddenException(
        'Subscription inactive. Write operations are disabled.',
      );
    }

    // Fallback: block unknown statuses
    throw new ForbiddenException('Subscription blocked');
  }

  /**
   * Checks if a request path matches one of the whitelisted patterns
   * that remain accessible when subscription is BLOCKED.
   */
  private isWhitelistedPath(path: string): boolean {
    // Normalize path: remove leading slash for consistent matching then re-add
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return BLOCKED_WHITELIST_PATTERNS.some((pattern) =>
      pattern.test(normalizedPath),
    );
  }
}
