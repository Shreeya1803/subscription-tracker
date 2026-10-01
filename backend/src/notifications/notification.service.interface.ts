export const NOTIFICATION_SERVICE = "NOTIFICATION_SERVICE";

export interface NotificationService {
  sendRenewalReminder(pushToken: string, subscriptionName: string, renewalDate: Date): Promise<void>;
}
