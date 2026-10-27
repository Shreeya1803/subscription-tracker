import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service.interface';
import { passwordResetEmail } from './reset-email-template';

/**
 * Sends emails through Resend's HTTPS API.
 * Uses HTTPS (port 443), so it also works on hosts that block SMTP ports (e.g. Render free).
 * Configured with RESEND_API_KEY and EMAIL_FROM.
 */
@Injectable()
export class ResendEmailService implements EmailService {
  private readonly logger = new Logger(ResendEmailService.name);
  private readonly apiKey: string;
  private readonly from: string;
  private readonly appName: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('RESEND_API_KEY') ?? '';
    this.appName = config.get<string>('APP_NAME') ?? 'Subscription Tracker';
    // Until the domain is verified in Resend, only onboarding@resend.dev can send,
    // and only to the Resend account owner's email address.
    this.from = config.get<string>('EMAIL_FROM') ?? `${this.appName} <onboarding@resend.dev>`;
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    const { subject, text, html } = passwordResetEmail(this.appName, resetLink);
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: this.from, to: [to], subject, text, html }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        const detail = (await res.text()).slice(0, 300);
        throw new Error(`Resend responded ${res.status}: ${detail}`);
      }
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (err) {
      // Never let a mail failure change the API response (prevents revealing which emails are registered).
      this.logger.error(`Failed to send password reset email to ${to}: ${(err as Error).message}`);
    }
  }
}