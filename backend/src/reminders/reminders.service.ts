import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_SERVICE } from '../notifications/notification.service.interface';
import type { NotificationService } from '../notifications/notification.service.interface';
import { addBillingCycle } from '../subscriptions/utils/add-billing-cycle';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_SERVICE)
    private readonly notificationService: NotificationService,
  ) {}

  // TDD Section 10.5. Runs daily in production; also callable directly via
  // a manual-trigger endpoint for testing, since we can't wait a real day
  // to verify scheduled logic actually works.
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async processReminders() {
    const results = { remindersSent: 0, renewalsRolledForward: 0 };
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: { status: 'active' },
      include: { user: true },
    });

    for (const sub of activeSubscriptions) {
      // Roll forward any subscription whose renewal date has already passed --
      // TDD 10.5's own stated behavior, never implemented until now.
      if (sub.nextRenewal < today) {
        const newRenewal = addBillingCycle(
          sub.nextRenewal,
          sub.billingCycle,
          sub.customCycleDays,
        );
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { nextRenewal: newRenewal, lastReminderSentAt: null },
        });
        results.renewalsRolledForward++;
        continue;
      }

      if (!sub.reminderEnabled || !sub.user.pushToken) {
        continue;
      }

      const reminderDate = new Date(sub.nextRenewal);
      reminderDate.setDate(reminderDate.getDate() - sub.reminderDaysBefore);

      const alreadySentThisCycle =
        sub.lastReminderSentAt !== null &&
        sub.lastReminderSentAt >= reminderDate;

      if (today >= reminderDate && !alreadySentThisCycle) {
        await this.notificationService.sendRenewalReminder(
          sub.user.pushToken,
          sub.name,
          sub.nextRenewal,
        );
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { lastReminderSentAt: new Date() },
        });
        results.remindersSent++;
      }
    }

    this.logger.log(
      `Reminder run complete: ${results.remindersSent} sent, ${results.renewalsRolledForward} renewals rolled forward`,
    );
    return results;
  }
}
