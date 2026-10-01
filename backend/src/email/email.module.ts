import { Module } from '@nestjs/common';
import { EMAIL_SERVICE } from './email.service.interface';
import { ConsoleEmailService } from './console-email.service';

@Module({
  providers: [
    {
      provide: EMAIL_SERVICE,
      useClass: ConsoleEmailService,
    },
  ],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}
