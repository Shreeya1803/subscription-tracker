import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_SERVICE } from './email.service.interface';
import { ConsoleEmailService } from './console-email.service';
import { SmtpEmailService } from './smtp-email.service';

@Module({
  providers: [
    {
      provide: EMAIL_SERVICE,
      inject: [ConfigService],
      // Real emails when SMTP_HOST is configured; otherwise log the link to the console (local development).
      useFactory: (config: ConfigService) => {
        if (config.get<string>('SMTP_HOST')) return new SmtpEmailService(config);
        new Logger('EmailModule').warn('SMTP_HOST is not set: password reset links will only be logged to the console.');
        return new ConsoleEmailService();
      },
    },
  ],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}
