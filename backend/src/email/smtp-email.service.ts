import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service.interface';

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
    const subject = `Reset your ${this.appName} password`;
    const text =
      `We received a request to reset your ${this.appName} password.\n\n` +
      `Open this link to choose a new password (valid for 1 hour):\n${resetLink}\n\n` +
      `If you didn't ask for this, you can ignore this email. Your password won't change.`;
    const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f5f2;font-family:Arial,Helvetica,sans-serif;color:#1c2b3a">
  <table role="presentation" width="100%" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
    <tr><td>
      <h2 style="margin:0 0 12px;font-size:20px">Reset your password</h2>
      <p style="margin:0 0 20px;line-height:1.5">We received a request to reset your ${this.appName} password. This link is valid for 1 hour.</p>
      <p style="margin:0 0 24px"><a href="${resetLink}" style="display:inline-block;background:#1c2b3a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold">Choose a new password</a></p>
      <p style="margin:0 0 8px;font-size:13px;color:#5f6b76">If the button doesn't work, copy this link into your browser:</p>
      <p style="margin:0 0 20px;font-size:13px;word-break:break-all"><a href="${resetLink}" style="color:#2f6f5e">${resetLink}</a></p>
      <p style="margin:0;font-size:13px;color:#5f6b76">If you didn't ask for this, you can ignore this email. Your password won't change.</p>
    </td></tr>
  </table></body></html>`;

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
