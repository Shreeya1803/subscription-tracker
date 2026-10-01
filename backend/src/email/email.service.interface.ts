export const EMAIL_SERVICE = "EMAIL_SERVICE";

export interface EmailService {
  sendPasswordResetEmail(to: string, resetLink: string): Promise<void>;
}
