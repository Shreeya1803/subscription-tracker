import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service.interface';
   import { passwordResetEmail } from './reset-email-template';

/**
 * Sends real emails through any SMTP provider (Resend, SendGrid, Amazon SES, Postmark, Brevo, Gmail...).
 * Configured with SMTP_* environment variables. See .env.example.
 */
@Injectable()
export class SmtpEmailService implements EmailService {
  private readonly logger = new Logger(SmtpEmailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly appName: string;

  constructor(config: ConfigService) {
    const port = Number(config.get<string>('SMTP_PORT') ?? 587);
    const secureSetting = config.get<string>('SMTP_SECURE');
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');

    this.transporter = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST'),
      port,
      // true for port 465 (implicit TLS); false for 587/25 (upgraded with STARTTLS)
      secure: secureSetting !== undefined ? secureSetting === 'true' : port === 465,
      auth: user ? { user, pass } : undefined,
    });
    this.appName = config.get<string>('APP_NAME') ?? 'Subscription Tracker';
    this.from = config.get<string>('EMAIL_FROM') ?? `${this.appName} <no-reply@localhost>`;
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
       const { subject, text, html } = passwordResetEmail(this.appName, resetLink);
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, text, html });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (err) {
      // Never let a mail failure change the API response: forgot-password must answer the same way
      // whether or not the account exists, otherwise an error would reveal which emails are registered.
      this.logger.error(`Failed to send password reset email to ${to}: ${(err as Error).message}`);
    }
  }
}
