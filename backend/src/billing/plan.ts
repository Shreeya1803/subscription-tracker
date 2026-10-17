export type PaidPlan = 'monthly' | 'annual' | 'lifetime';

/**
 * Maps a store / RevenueCat product id to our plan.
 * Works for Test Store ids (monthly, yearly, lifetime), Google Play ids
 * (subscript_monthly, subscript_annual:annual, subscript_lifetime) and App Store ids.
 */
export function planForProduct(productId: string | null | undefined, expiresAt: Date | null): PaidPlan {
  const id = (productId ?? '').toLowerCase();
  if (id.includes('lifetime')) return 'lifetime';
  if (id.includes('annual') || id.includes('year')) return 'annual';
  if (id.includes('month')) return 'monthly';
  // Unknown product: a purchase that never expires is lifetime, anything else is treated as monthly.
  return expiresAt ? 'monthly' : 'lifetime';
}

/** Google Play ids can arrive as "subscription:baseplan"; compare only the subscription part. */
export function sameProduct(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.split(':')[0] === b.split(':')[0];
}