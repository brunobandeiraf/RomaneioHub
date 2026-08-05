import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionStatus } from '@compras-hub/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { SKIP_SUBSCRIPTION_CHECK_KEY } from '../decorators/skip-subscription-check.decorator';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_SUBSCRIPTION_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantId: string | undefined = request.tenantId;

    if (!tenantId) {
      throw new ForbiddenException('Subscription blocked');
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

    // ACTIVE or TRIAL: allow all operations
    if (
      status === SubscriptionStatus.ACTIVE ||
      status === SubscriptionStatus.TRIAL
    ) {
      return true;
    }

    // BLOCKED or CANCELLED: block all operations
    if (
      status === SubscriptionStatus.BLOCKED ||
      status === SubscriptionStatus.CANCELLED
    ) {
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
        'Subscription inactive - read-only mode',
      );
    }

    // Fallback: block unknown statuses
    throw new ForbiddenException('Subscription blocked');
  }
}
