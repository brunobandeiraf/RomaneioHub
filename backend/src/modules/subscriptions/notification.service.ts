import { Injectable, Logger } from '@nestjs/common';

/**
 * NotificationService handles email notifications for subscription lifecycle events.
 * Currently logs events — SES integration will be added in a future iteration.
 *
 * @validates Requirements 14.4
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  /**
   * Send notification when a subscription is cancelled and grace period begins.
   */
  async sendCancellationEmail(tenantId: string, email: string): Promise<void> {
    this.logger.log(
      `[NOTIFICATION] Cancellation email sent to ${email} for tenant ${tenantId}. ` +
        `30-day grace period has started.`,
    );
    // TODO: Integrate with AWS SES
  }

  /**
   * Send warning notification N days before grace period expires.
   */
  async sendGracePeriodWarningEmail(
    tenantId: string,
    email: string,
    daysRemaining: number,
  ): Promise<void> {
    this.logger.log(
      `[NOTIFICATION] Grace period warning email sent to ${email} for tenant ${tenantId}. ` +
        `${daysRemaining} days remaining before data deletion.`,
    );
    // TODO: Integrate with AWS SES
  }

  /**
   * Send notification when grace period has expired and data will be anonymized/deleted.
   */
  async sendGracePeriodExpiredEmail(
    tenantId: string,
    email: string,
  ): Promise<void> {
    this.logger.log(
      `[NOTIFICATION] Grace period expired email sent to ${email} for tenant ${tenantId}. ` +
        `Data anonymization/deletion scheduled.`,
    );
    // TODO: Integrate with AWS SES
  }
}
