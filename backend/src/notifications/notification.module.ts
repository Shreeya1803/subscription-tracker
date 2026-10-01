import { Module } from '@nestjs/common';
import { NOTIFICATION_SERVICE } from './notification.service.interface';
import { ConsoleNotificationService } from './console-notification.service';

@Module({
  providers: [
    {
      provide: NOTIFICATION_SERVICE,
      useClass: ConsoleNotificationService,
    },
  ],
  exports: [NOTIFICATION_SERVICE],
})
export class NotificationModule {}
