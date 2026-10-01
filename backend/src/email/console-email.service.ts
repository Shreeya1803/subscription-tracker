import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from './email.service.interface';

// STUB: no real email provider wired in yet (client decision pending).
// Logs to the server console so the reset flow is fully testable locally.
// Swapping this for a real provider later means writing one new class that
// implements EmailService and changing the provider binding in EmailModule
// -- nothing in AuthService or anywhere else needs to change.
@Injectable()
export class ConsoleEmailService implements EmailService {
  private readonly logger = new Logger(ConsoleEmailService.name);

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    this.logger.log(`[DEV] Password reset link for ${to}: ${resetLink}`);
  }
}
