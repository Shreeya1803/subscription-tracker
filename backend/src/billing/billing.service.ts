import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { planForProduct, sameProduct } from './plan';

/** The subset of a RevenueCat webhook event we use. */
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
  environment?: string;
  expiration_at_ms?: number | null;
  purchased_at_ms?: number | null;
  event_timestamp_ms?: number | null;
  price?: number | null;
  currency?: string | null;
  transaction_id?: string | null;
  original_transaction_id?: string | null;
  cancel_reason?: string | null;
  expiration_reason?: string | null;
};

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

type PremiumUser = {
  id: string;
  premiumStatus: 'free' | 'monthly' | 'annual' | 'lifetime';
  premiumExpiresAt: Date | null;
  premiumProductId: string | null;
};
const premiumSelect = { id: true, premiumStatus: true, premiumExpiresAt: true, premiumProductId: true } as const;

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get entitlementId() {
    return this.config.get<string>('REVENUECAT_ENTITLEMENT_ID') ?? 'subscription_tracker_pro';
  }

  // ---------------------------------------------------------------- webhook

  async handleWebhook(authorization: string | undefined, body: unknown) {
    this.checkWebhookAuth(authorization);

    const event = (body as { event?: RcEvent } | null)?.event;
    if (!event?.type) throw new BadRequestException('Missing event');

    if (event.type === 'TEST') {
      this.logger.log('RevenueCat test webhook received');
      return { ok: true, ignored: 'test event' };
    }

    // RevenueCat can deliver the same event more than once.
    if (event.id) {
      const seen = await this.prisma.paymentEvent.findUnique({ where: { eventId: event.id }, select: { id: true } });
      if (seen) return { ok: true, duplicate: true };
    }

    if (event.type === 'TRANSFER') {
      // Purchases moved between app users (for example a new account on the same Apple ID).
      // Re-check both sides against RevenueCat.
      for (const id of [...(event.transferred_from ?? []), ...(event.transferred_to ?? [])]) {
        if (UUID.test(id)) await this.syncUser(id).catch((e) => this.logger.warn(`Transfer sync failed for ${id}: ${e.message}`));
      }
      return { ok: true, handled: 'transfer' };
    }

    const user = await this.findUser(event);
    if (!user) {
      // Not one of our accounts (for example an anonymous RevenueCat id). Acknowledge so RevenueCat stops retrying.
      this.logger.warn(`RevenueCat ${event.type} for unknown app user ${event.app_user_id}`);
      return { ok: true, ignored: 'unknown user' };
    }

    const recorded = await this.recordEvent(user.id, event);
    if (!recorded) return { ok: true, duplicate: true };

    const entitlements = event.entitlement_ids ?? (event.entitlement_id ? [event.entitlement_id] : []);
    if (!entitlements.includes(this.entitlementId)) {
      return { ok: true, ignored: 'other entitlement' };
    }

    const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;

    if (GRANT_EVENTS.has(event.type)) {
      if (expiresAt && expiresAt.getTime() < Date.now()) {
        // Stale or out-of-order delivery for a period that has already ended.
        return { ok: true, ignored: 'already expired' };
      }
      await this.grant(user, event.product_id ?? null, expiresAt, event.store ?? null);
      return { ok: true, handled: 'granted' };
    }

    if (event.type === 'EXPIRATION') {
      await this.revokeIfCurrent(user, event.product_id ?? null);
      return { ok: true, handled: 'expired' };
    }

    if (event.type === 'CANCELLATION') {
      // A normal cancellation only stops auto-renew: access continues until the expiry date.
      // CUSTOMER_SUPPORT means a refund, so access ends now.
      if (event.cancel_reason === 'CUSTOMER_SUPPORT') {
        await this.revokeIfCurrent(user, event.product_id ?? null);
        return { ok: true, handled: 'refunded' };
      }
      return { ok: true, handled: 'cancellation noted' };
    }

    // BILLING_ISSUE (grace period), SUBSCRIPTION_PAUSED, PRODUCT_CHANGE, etc.: no change to access.
    return { ok: true, handled: 'logged only' };
  }

  private checkWebhookAuth(authorization: string | undefined) {
    const expected = this.config.get<string>('REVENUECAT_WEBHOOK_AUTH');
    if (!expected) {
      this.logger.error('REVENUECAT_WEBHOOK_AUTH is not set: rejecting RevenueCat webhook');
      throw new UnauthorizedException();
    }
    // Accept the value as configured in RevenueCat, with or without a "Bearer " prefix.
    const received = (authorization ?? '').replace(/^Bearer\s+/i, '');
    const want = expected.replace(/^Bearer\s+/i, '');
    const a = createHash('sha256').update(received).digest();
    const b = createHash('sha256').update(want).digest();
    if (!received || !timingSafeEqual(a, b)) throw new UnauthorizedException();
  }

  private async findUser(event: RcEvent): Promise<PremiumUser | null> {
    const ids = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])].filter(
      (id): id is string => !!id && UUID.test(id),
    );
    for (const id of new Set(ids)) {
      const user = await this.prisma.user.findUnique({ where: { id }, select: premiumSelect });
      if (user) return user as PremiumUser;
    }
    return null;
  }

  /** Stores the event in payment_events. Returns false if it was already stored (parallel re-delivery). */
  private async recordEvent(userId: string, event: RcEvent): Promise<boolean> {
    const when = event.purchased_at_ms ?? event.event_timestamp_ms ?? Date.now();
    try {
      await this.prisma.paymentEvent.create({
        data: {
          userId,
          provider: event.store ?? 'unknown',
          productId: event.product_id ?? '',
          receiptReference: event.transaction_id ?? event.original_transaction_id ?? event.id ?? '',
          amount: typeof event.price === 'number' ? event.price : null,
          currency: event.currency ?? null,
          purchasedAt: new Date(when),
          eventId: event.id ?? null,
          eventType: event.type ?? null,
        },
      });
      return true;
    } catch (e: any) {
      if (e?.code === 'P2002') return false; // unique event_id: already processed
      throw e;
    }
  }

  // ---------------------------------------------------------------- plan changes

  private async grant(user: PremiumUser, productId: string | null, expiresAt: Date | null, store: string | null) {
    const plan = planForProduct(productId, expiresAt);
    // Never downgrade a lifetime owner because a separate subscription event arrives.
    if (user.premiumStatus === 'lifetime' && plan !== 'lifetime') return;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        premiumStatus: plan,
        premiumExpiresAt: plan === 'lifetime' ? null : expiresAt,
        premiumProductId: productId,
        premiumStore: store,
      },
    });
    this.logger.log(`User ${user.id} is now ${plan}${expiresAt ? ` until ${expiresAt.toISOString()}` : ''}`);
  }

  /** Removes premium only if the ending product is the one that gives the user access. */
  private async revokeIfCurrent(user: PremiumUser, productId: string | null) {
    if (user.premiumStatus === 'free') return;
    const endingPlan = planForProduct(productId, new Date());
    if (user.premiumStatus === 'lifetime' && endingPlan !== 'lifetime') return;
    if (user.premiumProductId && productId && !sameProduct(user.premiumProductId, productId)) return;
    await this.setFree(user.id);
  }

  private async setFree(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { premiumStatus: 'free', premiumExpiresAt: null, premiumProductId: null, premiumStore: null },
    });
    this.logger.log(`User ${userId} is now free`);
  }

  // ---------------------------------------------------------------- sync with RevenueCat

  /**
   * Asks RevenueCat for the user's current entitlement and stores the result.
   * Used right after a purchase or restore, so the app does not wait for the webhook,
   * and by the hourly check. Without REVENUECAT_SECRET_KEY it only returns the stored state.
   */
  async syncUser(userId: string) {
    const key = this.config.get<string>('REVENUECAT_SECRET_KEY');
    if (key) {
      const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`RevenueCat responded ${res.status}`);
      const data = (await res.json()) as {
        subscriber?: {
          entitlements?: Record<
            string,
            { expires_date?: string | null; grace_period_expires_date?: string | null; product_identifier?: string }
          >;
        };
      };
      const ent = data.subscriber?.entitlements?.[this.entitlementId];
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: premiumSelect });
      if (user) {
        const expires = ent?.expires_date ? new Date(ent.expires_date) : null;
        const grace = ent?.grace_period_expires_date ? new Date(ent.grace_period_expires_date) : null;
        const accessUntil = Math.max(expires?.getTime() ?? 0, grace?.getTime() ?? 0);
        const active = !!ent && (expires === null || accessUntil > Date.now());
        if (active) {
          // Sync is authoritative, so a lifetime purchase found here wins and an ended lifetime is not assumed.
          const plan = planForProduct(ent!.product_identifier ?? null, expires);
          await this.prisma.user.update({
            where: { id: userId },
            data: {
              premiumStatus: plan,
              premiumExpiresAt: plan === 'lifetime' ? null : new Date(accessUntil),
              premiumProductId: ent!.product_identifier ?? null,
            },
          });
        } else if (user.premiumStatus !== 'free') {
          await this.setFree(userId);
        }
      }
    }
    const fresh = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { premiumStatus: true, premiumExpiresAt: true },
    });
    return { ...fresh, synced: !!key };
  }

  /** Hourly safety net in case an EXPIRATION webhook was missed. */
  @Cron(CronExpression.EVERY_HOUR)
  async expireLapsedPlans() {
    const hasKey = !!this.config.get<string>('REVENUECAT_SECRET_KEY');
    // With the secret key we can ask RevenueCat (handles renewals and grace periods);
    // without it, wait 3 days for a renewal webhook before downgrading.
    const cutoff = new Date(Date.now() - (hasKey ? HOUR : 3 * DAY));
    const lapsed = await this.prisma.user.findMany({
      where: { premiumStatus: { not: 'free' }, premiumExpiresAt: { lt: cutoff } },
      select: { id: true },
      take: 200,
    });
    for (const { id } of lapsed) {
      try {
        if (hasKey) await this.syncUser(id);
        else await this.setFree(id);
      } catch (e: any) {
        this.logger.warn(`Expiry check failed for ${id}: ${e?.message}`);
      }
    }
  }
}