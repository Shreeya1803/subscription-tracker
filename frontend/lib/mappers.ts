import type { ApiSubscription } from '@/lib/api';
import type { Subscription, SubscriptionInput } from '@/context/SubscriptionContext';

const dateOnly = (iso: string) => iso.slice(0, 10);

/** Backend row -> UI model. Amount is a Decimal string; dates are ISO datetimes (UI expects YYYY-MM-DD). */
export function fromApi(s: ApiSubscription): Subscription {
  return {
    id: s.id,
    name: s.name,
    amount: Number(s.amount),
    currency: s.currency,
    billingCycle: s.billingCycle,
    customCycleDays: s.customCycleDays ?? undefined,
    nextRenewal: dateOnly(s.nextRenewal),
    category: s.category,
    reminderEnabled: s.reminderEnabled,
    reminderDaysBefore: s.reminderDaysBefore,
    lastUsedDate: s.lastUsedDate ? dateOnly(s.lastUsedDate) : undefined,
    status: s.status,
    notes: s.notes ?? undefined,
    createdAt: s.createdAt,
  };
}

/**
 * UI model -> request body. The backend uses forbidNonWhitelisted, so ONLY fields
 * from CreateSubscriptionDto may be sent (never id, status, createdAt, ...).
 * customCycleDays must be omitted unless billingCycle === 'custom'.
 */
export function toApiBody(v: SubscriptionInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    name: v.name,
    amount: v.amount,
    currency: v.currency,
    billingCycle: v.billingCycle,
    nextRenewal: v.nextRenewal,
    category: v.category,
    reminderEnabled: v.reminderEnabled,
    reminderDaysBefore: v.reminderDaysBefore,
  };
  if (v.billingCycle === 'custom') body.customCycleDays = v.customCycleDays;
  if (v.notes) body.notes = v.notes;
  return body;
}

/** For edits: send only fields that changed, so untouched fields (and reminder state) aren't reset. */
export function toApiPatch(prev: Subscription, next: SubscriptionInput): Record<string, unknown> {
  const full = toApiBody(next);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(full)) {
    if ((prev as Record<string, unknown>)[key] !== value) patch[key] = value;
  }
  // notes can be cleared: toApiBody omits empty notes, so handle explicitly
  if (!next.notes && prev.notes) patch.notes = '';
  return patch;
}
