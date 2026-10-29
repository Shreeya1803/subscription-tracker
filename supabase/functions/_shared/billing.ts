// RevenueCat billing logic, ported from the NestJS BillingService (same rules):
//  * webhook: record every event once, grant/revoke the Premium entitlement;
//  * sync: ask RevenueCat for the user's current entitlement (after a purchase or restore);
//  * expiry: hourly safety net in case an EXPIRATION webhook was missed.
import { type Admin, secretsMatch } from './supabase.ts';

export type Plan = 'free' | 'monthly' | 'annual' | 'lifetime';
export type PaidPlan = Exclude<Plan, 'free'>;

export type BillingConfig = {
  entitlementId: string;
  webhookAuth?: string;
  secretKey?: string;      // RevenueCat secret API key (sk_...)
  apiBase?: string;        // overridable for tests
  now?: () => number;      // overridable for tests
};

type RcEvent = {
  id?: string;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  product_id?: string;
  store?: string;
  expiration_at_ms?: number | null;
  purchased_at_ms?: number | null;
  event_timestamp_ms?: number | null;
  price?: number | null;
  currency?: string | null;
  transaction_id?: string | null;
  original_transaction_id?: string | null;
  cancel_reason?: string | null;
};

type PremiumUser = {
  id: string;
  premium_status: Plan;
  premium_expires_at: string | null;
  premium_product_id: string | null;
};

const PREMIUM_COLUMNS = 'id, premium_status, premium_expires_at, premium_product_id';

/** Events that mean "the user has access now, until expiration_at_ms (null = forever)". */
const GRANT_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------- products

/**
 * Maps a store / RevenueCat product id to our plan. Works for Test Store ids (monthly, yearly, lifetime),
 * Google Play ids (subscript_monthly:monthly, subscript_annual:annual, subscript_lifetime) and App Store ids.
 */
export function planForProduct(productId: string | null | undefined, expiresAt: Date | null): PaidPlan {
  const id = (productId ?? '').toLowerCase();
  if (id.includes('lifetime')) return 'lifetime';
  if (id.includes('annual') || id.includes('year')) return 'annual';
  if (id.includes('month')) return 'monthly';
  return expiresAt ? 'monthly' : 'lifetime';
}

/** Google Play ids can arrive as "subscription:baseplan"; compare only the subscription part. */
export function sameProduct(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.split(':')[0] === b.split(':')[0];
}

// ---------------------------------------------------------------- database helpers

async function getUser(admin: Admin, id: string): Promise<PremiumUser | null> {
  const { data, error } = await admin.from('users').select(PREMIUM_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(`load user ${id}: ${error.message}`);
  return data as PremiumUser | null;
}

async function updateUser(admin: Admin, id: string, values: Record<string, unknown>) {
  const { error } = await admin.from('users').update(values).eq('id', id);
  if (error) throw new Error(`update user ${id}: ${error.message}`);
}

async function setFree(admin: Admin, id: string) {
  await updateUser(admin, id, {
    premium_status: 'free',
    premium_expires_at: null,
    premium_product_id: null,
    premium_store: null,
  });
  console.log(`User ${id} is now free`);
}

async function grant(admin: Admin, user: PremiumUser, productId: string | null, expiresAt: Date | null, store: string | null) {
  const plan = planForProduct(productId, expiresAt);
  // Never downgrade a lifetime owner because a separate subscription event arrives.
  if (user.premium_status === 'lifetime' && plan !== 'lifetime') return;
  await updateUser(admin, user.id, {
    premium_status: plan,
    premium_expires_at: plan === 'lifetime' ? null : expiresAt?.toISOString() ?? null,
    premium_product_id: productId,
    premium_store: store,
  });
  console.log(`User ${user.id} is now ${plan}${expiresAt ? ` until ${expiresAt.toISOString()}` : ''}`);
}

/** Removes premium only if the ending product is the one that gives the user access. */
async function revokeIfCurrent(admin: Admin, user: PremiumUser, productId: string | null) {
  if (user.premium_status === 'free') return;
  const endingPlan = planForProduct(productId, new Date());
  if (user.premium_status === 'lifetime' && endingPlan !== 'lifetime') return;
  if (user.premium_product_id && productId && !sameProduct(user.premium_product_id, productId)) return;
  await setFree(admin, user.id);
}

async function findUser(admin: Admin, event: RcEvent): Promise<PremiumUser | null> {
  const ids = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])].filter(
    (id): id is string => !!id && UUID.test(id),
  );
  for (const id of new Set(ids)) {
    const user = await getUser(admin, id);
    if (user) return user;
  }
  return null;
}

/** Stores the event in payment_events. Returns false if it was already stored (re-delivery). */
async function recordEvent(admin: Admin, userId: string, event: RcEvent, now: number): Promise<boolean> {
  const when = event.purchased_at_ms ?? event.event_timestamp_ms ?? now;
  const { error } = await admin.from('payment_events').insert({
    user_id: userId,
    provider: event.store ?? 'unknown',
    product_id: event.product_id ?? '',
    receipt_reference: event.transaction_id ?? event.original_transaction_id ?? event.id ?? '',
    amount: typeof event.price === 'number' ? event.price : null,
    currency: event.currency ?? null,
    purchased_at: new Date(when).toISOString(),
    event_id: event.id ?? null,
    event_type: event.type ?? null,
  });
  if (!error) return true;
  if (error.code === '23505') return false; // unique event_id: already processed
  throw new Error(`record event: ${error.message}`);
}

// ---------------------------------------------------------------- webhook

export async function handleWebhook(admin: Admin, cfg: BillingConfig, authorization: string | null, body: unknown) {
  const now = cfg.now?.() ?? Date.now();
  const expected = (cfg.webhookAuth ?? '').replace(/^Bearer\s+/i, '');
  const received = (authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!expected) {
    console.error('REVENUECAT_WEBHOOK_AUTH is not set: rejecting RevenueCat webhook');
    throw new HttpError(401, 'Unauthorized');
  }
  if (!(await secretsMatch(received, expected))) throw new HttpError(401, 'Unauthorized');

  const event = (body as { event?: RcEvent } | null)?.event;
  if (!event?.type) throw new HttpError(400, 'Missing event');

  if (event.type === 'TEST') {
    console.log('RevenueCat test webhook received');
    return { ok: true, ignored: 'test event' };
  }

  if (event.id) {
    const { data } = await admin.from('payment_events').select('id').eq('event_id', event.id).maybeSingle();
    if (data) return { ok: true, duplicate: true };
  }

  if (event.type === 'TRANSFER') {
    for (const id of [...(event.transferred_from ?? []), ...(event.transferred_to ?? [])]) {
      if (UUID.test(id)) {
        await syncUser(admin, cfg, id).catch((e) => console.warn(`Transfer sync failed for ${id}: ${e.message}`));
      }
    }
    return { ok: true, handled: 'transfer' };
  }

  const user = await findUser(admin, event);
  if (!user) {
    console.warn(`RevenueCat ${event.type} for unknown app user ${event.app_user_id}`);
    return { ok: true, ignored: 'unknown user' };
  }

  if (!(await recordEvent(admin, user.id, event, now))) return { ok: true, duplicate: true };

  const entitlements = event.entitlement_ids ?? (event.entitlement_id ? [event.entitlement_id] : []);
  if (!entitlements.includes(cfg.entitlementId)) return { ok: true, ignored: 'other entitlement' };

  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;

  if (GRANT_EVENTS.has(event.type)) {
    if (expiresAt && expiresAt.getTime() < now) return { ok: true, ignored: 'already expired' };
    await grant(admin, user, event.product_id ?? null, expiresAt, event.store ?? null);
    return { ok: true, handled: 'granted' };
  }

  if (event.type === 'EXPIRATION') {
    await revokeIfCurrent(admin, user, event.product_id ?? null);
    return { ok: true, handled: 'expired' };
  }

  if (event.type === 'CANCELLATION') {
    // A normal cancellation only stops auto-renew; CUSTOMER_SUPPORT means a refund, so access ends now.
    if (event.cancel_reason === 'CUSTOMER_SUPPORT') {
      await revokeIfCurrent(admin, user, event.product_id ?? null);
      return { ok: true, handled: 'refunded' };
    }
    return { ok: true, handled: 'cancellation noted' };
  }

  return { ok: true, handled: 'logged only' };
}

// ---------------------------------------------------------------- sync with RevenueCat

export async function syncUser(admin: Admin, cfg: BillingConfig, userId: string) {
  const now = cfg.now?.() ?? Date.now();
  if (cfg.secretKey) {
    const base = cfg.apiBase ?? 'https://api.revenuecat.com';
    const res = await fetch(`${base}/v1/subscribers/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${cfg.secretKey}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`RevenueCat responded ${res.status}`);
    const data = (await res.json()) as {
      subscriber?: {
        entitlements?: Record<string, { expires_date?: string | null; grace_period_expires_date?: string | null; product_identifier?: string }>;
      };
    };
    const ent = data.subscriber?.entitlements?.[cfg.entitlementId];
    const user = await getUser(admin, userId);
    if (user) {
      const expires = ent?.expires_date ? new Date(ent.expires_date) : null;
      const grace = ent?.grace_period_expires_date ? new Date(ent.grace_period_expires_date) : null;
      const accessUntil = Math.max(expires?.getTime() ?? 0, grace?.getTime() ?? 0);
      const active = !!ent && (expires === null || accessUntil > now);
      if (active) {
        const plan = planForProduct(ent!.product_identifier ?? null, expires);
        await updateUser(admin, userId, {
          premium_status: plan,
          premium_expires_at: plan === 'lifetime' ? null : new Date(accessUntil).toISOString(),
          premium_product_id: ent!.product_identifier ?? null,
        });
      } else if (user.premium_status !== 'free') {
        await setFree(admin, userId);
      }
    }
  }
  const fresh = await getUser(admin, userId);
  return {
    premiumStatus: fresh?.premium_status ?? 'free',
    premiumExpiresAt: fresh?.premium_expires_at ?? null,
    synced: !!cfg.secretKey,
  };
}

/** Hourly safety net in case an EXPIRATION webhook was missed. */
export async function expireLapsedPlans(admin: Admin, cfg: BillingConfig) {
  const now = cfg.now?.() ?? Date.now();
  const hasKey = !!cfg.secretKey;
  // With the secret key, ask RevenueCat (handles renewals and grace periods);
  // without it, wait 3 days for a renewal webhook before downgrading.
  const cutoff = new Date(now - (hasKey ? HOUR : 3 * DAY)).toISOString();
  const { data, error } = await admin
    .from('users')
    .select('id')
    .neq('premium_status', 'free')
    .lt('premium_expires_at', cutoff)
    .limit(200);
  if (error) throw new Error(`load lapsed plans: ${error.message}`);
  let checked = 0;
  for (const { id } of data ?? []) {
    try {
      if (hasKey) await syncUser(admin, cfg, id);
      else await setFree(admin, id);
      checked++;
    } catch (e) {
      console.warn(`Expiry check failed for ${id}: ${(e as Error).message}`);
    }
  }
  return { checked };
}

export function billingConfig(): BillingConfig {
  const get = (n: string) => Deno.env.get(n)?.trim() || undefined;
  return {
    entitlementId: get('REVENUECAT_ENTITLEMENT_ID') ?? 'subscription_tracker_pro',
    webhookAuth: get('REVENUECAT_WEBHOOK_AUTH'),
    secretKey: get('REVENUECAT_SECRET_KEY'),
  };
}