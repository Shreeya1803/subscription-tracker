import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EMAIL_SERVICE } from './email.service.interface';
import { ConsoleEmailService } from './console-email.service';
import { ResendEmailService } from './resend-email.service';
import { SmtpEmailService } from './smtp-email.service';

@Module({
  providers: [
    {
      provide: EMAIL_SERVICE,
      inject: [ConfigService],
      // Resend API if RESEND_API_KEY is set, else SMTP if SMTP_HOST is set,
      // else log the link to the console (local development).
      useFactory: (config: ConfigService) => {
        if (config.get<string>('RESEND_API_KEY')) return new ResendEmailService(config);
        if (config.get<string>('SMTP_HOST')) return new SmtpEmailService(config);
        new Logger('EmailModule').warn(
          'Neither RESEND_API_KEY nor SMTP_HOST is set: password reset links will only be logged to the console.',
        );
        return new ConsoleEmailService();
      },
    },
  ],
  exports: [EMAIL_SERVICE],
})
export class EmailModule {}