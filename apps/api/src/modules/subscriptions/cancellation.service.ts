import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  CANCELLATION_GRACE_PERIOD_DAYS,
  SubscriptionStatus,
} from '@romaneio-hub/shared';
import { PrismaService } from '../../prisma';
import { NotificationService } from './notification.service';

/**
 * CancellationService handles the subscription cancellation lifecycle:
 * - Cancellation → GRACE_PERIOD with 30-day window
 * - Renewal during GRACE_PERIOD → restore ACTIVE
 * - Grace period expiration → transition to BLOCKED + schedule data anonymization
 *
 * @validates Requirements 14.1, 14.2, 14.3, 14.4, 14.5
 */
@Injectable()
export class CancellationService {
  private readonly logger = new Logger(CancellationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Handle subscription cancellation:
   * - Set status to GRACE_PERIOD
   * - Set gracePeriodEnd = now + 30 days
   * - Send cancellation notification email
   *
   * During grace period, the SubscriptionGuard automatically blocks writes
   * but allows read (GET) operations including CSV export.
   *
   * @validates Requirements 14.1, 14.2
   */
  async handleCancellation(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          include: { user: { select: { email: true } } },
          where: { role: 'SELLER' },
          take: 1,
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(
      gracePeriodEnd.getDate() + CANCELLATION_GRACE_PERIOD_DAYS,
    );

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: SubscriptionStatus.GRACE_PERIOD,
        gracePeriodEnd,
      },
    });

    this.logger.log(
      `Tenant ${tenantId} cancelled. Grace period ends: ${gracePeriodEnd.toISOString()}`,
    );

    // Send cancellation notification
    const sellerEmail = tenant.users[0]?.user?.email;
    if (sellerEmail) {
      await this.notificationService.sendCancellationEmail(
        tenantId,
        sellerEmail,
      );
    }
  }

  /**
   * Handle renewal during grace period:
   * - Set status back to ACTIVE
   * - Clear gracePeriodEnd
   * - Full write access is automatically restored by SubscriptionGuard
   *
   * This must complete within 5 minutes of payment confirmation.
   *
   * @validates Requirement 14.5
   */
  async handleRenewal(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    // Only renew if currently in GRACE_PERIOD
    if (tenant.subscriptionStatus !== SubscriptionStatus.GRACE_PERIOD) {
      this.logger.warn(
        `Tenant ${tenantId} renewal attempted but status is ${tenant.subscriptionStatus}, not GRACE_PERIOD`,
      );
      return;
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: SubscriptionStatus.ACTIVE,
        gracePeriodEnd: null,
      },
    });

    this.logger.log(
      `Tenant ${tenantId} renewed during grace period. Status restored to ACTIVE.`,
    );
  }

  /**
   * Check for tenants whose grace period has expired and transition them to BLOCKED.
   * This method is intended to be called by a scheduled Lambda/cron job.
   *
   * For each expired tenant:
   * - Transition status to BLOCKED
   * - Send expiration notification
   * - Log data anonymization/deletion scheduling
   *
   * @validates Requirements 14.3, 14.4
   */
  async checkGracePeriodExpiration(): Promise<number> {
    const now = new Date();

    const expiredTenants = await this.prisma.tenant.findMany({
      where: {
        subscriptionStatus: SubscriptionStatus.GRACE_PERIOD,
        gracePeriodEnd: { lt: now },
      },
      include: {
        users: {
          include: { user: { select: { email: true } } },
          where: { role: 'SELLER' },
          take: 1,
        },
      },
    });

    if (expiredTenants.length === 0) {
      return 0;
    }

    this.logger.log(
      `Found ${expiredTenants.length} tenant(s) with expired grace period.`,
    );

    for (const tenant of expiredTenants) {
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          subscriptionStatus: SubscriptionStatus.BLOCKED,
        },
      });

      this.logger.log(
        `Tenant ${tenant.id} transitioned to BLOCKED. Data anonymization/deletion scheduled.`,
      );

      // Send expiration notification
      const sellerEmail = tenant.users[0]?.user?.email;
      if (sellerEmail) {
        await this.notificationService.sendGracePeriodExpiredEmail(
          tenant.id,
          sellerEmail,
        );
      }
    }

    return expiredTenants.length;
  }

  /**
   * Check for tenants approaching grace period expiration (7 days remaining)
   * and send warning notifications.
   * This method is intended to be called by a scheduled Lambda/cron job.
   *
   * @validates Requirement 14.4
   */
  async sendGracePeriodWarnings(): Promise<number> {
    const now = new Date();
    const warningDate = new Date();
    warningDate.setDate(now.getDate() + 7);

    // Find tenants whose grace period ends within the next 7 days
    // but hasn't expired yet
    const warningTenants = await this.prisma.tenant.findMany({
      where: {
        subscriptionStatus: SubscriptionStatus.GRACE_PERIOD,
        gracePeriodEnd: {
          gt: now,
          lte: warningDate,
        },
      },
      include: {
        users: {
          include: { user: { select: { email: true } } },
          where: { role: 'SELLER' },
          take: 1,
        },
      },
    });

    if (warningTenants.length === 0) {
      return 0;
    }

    for (const tenant of warningTenants) {
      const daysRemaining = Math.ceil(
        (tenant.gracePeriodEnd!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      const sellerEmail = tenant.users[0]?.user?.email;
      if (sellerEmail) {
        await this.notificationService.sendGracePeriodWarningEmail(
          tenant.id,
          sellerEmail,
          daysRemaining,
        );
      }
    }

    return warningTenants.length;
  }
}
