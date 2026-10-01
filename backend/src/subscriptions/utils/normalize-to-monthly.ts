import { BillingCycle } from '../../../generated/prisma/enums';

// Ports TDD Section 10.1's normalize_to_monthly, corrected: the original
// pseudocode silently falls back to a monthly multiplier if a 'custom' cycle
// has no valid customCycleDays (flagged earlier as a real bug). Our API-level
// validation (IsValidCustomCycleDays) guarantees this can't happen through
// normal use, but this function throws rather than silently miscalculating
// if that invariant is ever violated by a future code path.
export function normalizeToMonthly(
  amount: number,
  billingCycle: BillingCycle,
  customCycleDays: number | null,
): number {
  const factors: Record<string, number> = {
    weekly: 52 / 12,
    monthly: 1,
    quarterly: 1 / 3,
    yearly: 1 / 12,
  };

  if (billingCycle === 'custom') {
    if (!customCycleDays || customCycleDays <= 0) {
      throw new Error(
        'Invalid state: custom billing cycle with no valid customCycleDays',
      );
    }
    return amount * (30.44 / customCycleDays);
  }

  return amount * (factors[billingCycle] ?? 1);
}
