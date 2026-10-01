import { BillingCycle } from '../../../generated/prisma/enums';

// TDD Section 10.5: "After renewal date passes, roll next_renewal forward
// by the billing cycle." Never implemented until now -- without this,
// nextRenewal stays stuck in the past permanently once a subscription's
// renewal date passes.
export function addBillingCycle(
  date: Date,
  billingCycle: BillingCycle,
  customCycleDays: number | null,
): Date {
  const result = new Date(date);

  switch (billingCycle) {
    case 'weekly':
      result.setDate(result.getDate() + 7);
      break;
    case 'monthly':
      result.setMonth(result.getMonth() + 1);
      break;
    case 'quarterly':
      result.setMonth(result.getMonth() + 3);
      break;
    case 'yearly':
      result.setFullYear(result.getFullYear() + 1);
      break;
    case 'custom':
      if (!customCycleDays || customCycleDays <= 0) {
        throw new Error(
          'Invalid state: custom billing cycle with no valid customCycleDays',
        );
      }
      result.setDate(result.getDate() + customCycleDays);
      break;
  }

  return result;
}
