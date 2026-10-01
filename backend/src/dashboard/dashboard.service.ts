import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeToMonthly } from '../subscriptions/utils/normalize-to-monthly';
import {ForbiddenException} from '@nestjs/common';
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // TDD Section 9.3 / 10.2 (compute_totals) + 10.3 (upcoming_renewals).
  // NOTE: sums normalized amounts directly with no FX conversion, matching
  // the TDD's own pseudocode. mixedCurrencies flags when that makes the
  // total unreliable -- flagged decision, not silently resolved.
  async getSummary(userId: string) {
    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: { userId, status: 'active' },
    });

    const monthly = activeSubscriptions.reduce(
      (sum, sub) =>
        sum +
        normalizeToMonthly(
          Number(sub.amount),
          sub.billingCycle,
          sub.customCycleDays,
        ),
      0,
    );

    const distinctCurrencies = new Set(
      activeSubscriptions.map((sub) => sub.currency),
    );

    const today = new Date();
    const windowEnd = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const upcomingRenewals = activeSubscriptions
      .filter((sub) => sub.nextRenewal >= today && sub.nextRenewal <= windowEnd)
      .sort((a, b) => a.nextRenewal.getTime() - b.nextRenewal.getTime());

    const savedEvents = await this.prisma.savedEvent.findMany({
      where: { userId },
    });
    const totalSaved = savedEvents.reduce(
      (sum, event) => sum + Number(event.monthlyAmountSaved),
      0,
    );

    return {
      monthlyTotal: Math.round(monthly * 100) / 100,
      annualTotal: Math.round(monthly * 12 * 100) / 100,
      mixedCurrencies: distinctCurrencies.size > 1,
      currencies: Array.from(distinctCurrencies),
      upcomingRenewals,
      totalMonthlySaved: Math.round(totalSaved * 100) / 100,
    };
  }
  async getUnusedSubscriptions(userId: string, thresholdDays = 30) {
  const user = await this.prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });

  if (user.premiumStatus === 'free') {
    throw new ForbiddenException(
      'Unused-subscription detection is a premium feature. Upgrade to see it.',
    );
  }

  const activeSubscriptions = await this.prisma.subscription.findMany({
    where: { userId, status: 'active' },
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - thresholdDays);

  // TDD 10.4: "if not last_used: return False # unknown, don't falsely flag"
  return activeSubscriptions.filter(
    (sub) => sub.lastUsedDate !== null && sub.lastUsedDate < cutoff,
  );
}
async getSpendTrends(userId: string, months = 6) {
  const user = await this.prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });

  if (user.premiumStatus === 'free') {
    throw new ForbiddenException(
      'Spend trends is a premium feature. Upgrade to see it.',
    );
  }

  const subscriptions = await this.prisma.subscription.findMany({
    where: { userId, status: { in: ['active', 'canceled'] } },
    include: { savedEvents: true },
  });

  const trends: { month: string; monthlyTotal: number }[] = [];
  const now = new Date();

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

    const total = subscriptions.reduce((sum, sub) => {
      const canceledAt = sub.savedEvents[0]?.canceledAt ?? null;
      const activeDuringMonth =
        sub.createdAt <= monthEnd && (canceledAt === null || canceledAt >= monthStart);
      if (!activeDuringMonth) return sum;
      return (
        sum + normalizeToMonthly(Number(sub.amount), sub.billingCycle, sub.customCycleDays)
      );
    }, 0);

    trends.push({
      month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
      monthlyTotal: Math.round(total * 100) / 100,
    });
  }

  const currentActive = await this.prisma.subscription.findMany({
    where: { userId, status: 'active' },
  });
  const categoryTotals = new Map<string, number>();
  for (const sub of currentActive) {
    const monthly = normalizeToMonthly(Number(sub.amount), sub.billingCycle, sub.customCycleDays);
    categoryTotals.set(sub.category, (categoryTotals.get(sub.category) ?? 0) + monthly);
  }
  const categoryBreakdown = Array.from(categoryTotals.entries()).map(([category, total]) => ({
    category,
    monthlyTotal: Math.round(total * 100) / 100,
  }));

  return {
    trends,
    categoryBreakdown,
    note: 'Trends reflect spend since each subscription was added to the app (based on when it was tracked here), not necessarily when the real-world subscription began. Paused subscriptions are excluded from trend totals (no reliable "paused since" date exists in the data model).',
  };
}

}

