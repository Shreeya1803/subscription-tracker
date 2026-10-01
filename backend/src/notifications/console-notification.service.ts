import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from './notification.service.interface';

// STUB: no real push provider (e.g. Expo push service) wired in yet --
// same pattern as ConsoleEmailService. Logs instead of sending, so the
// reminder cron logic is fully testable before a mobile app exists to
// register real push tokens.
@Injectable()
export class ConsoleNotificationService implements NotificationService {
  private readonly logger = new Logger(ConsoleNotificationService.name);

  async sendRenewalReminder(
    pushToken: string,
    subscriptionName: string,
    renewalDate: Date,
  ): Promise<void> {
    this.logger.log(
      `[DEV] Push to ${pushToken}: "${subscriptionName}" renews on ${renewalDate.toDateString()}`,
    );
  }
}
