import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { normalizeToMonthly } from './utils/normalize-to-monthly';
import { FindSubscriptionsQueryDto } from './dto/find-subscriptions-query.dto';
import {ForbiddenException} from '@nestjs/common';
@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}
async create(userId: string, dto: CreateSubscriptionDto) {
  const user = await this.prisma.user.findUniqueOrThrow({
    where: { id: userId },
  });

  if (user.premiumStatus === 'free') {
    const activeCount = await this.prisma.subscription.count({
      where: { userId, status: 'active' },
    });
    if (activeCount >= 3) {
      throw new ForbiddenException(
        'Free tier is limited to 3 active subscriptions. Upgrade to premium for unlimited tracking.',
      );
    }
  }

  return this.prisma.subscription.create({
    data: {
      userId,
      name: dto.name,
      amount: dto.amount,
      currency: dto.currency,
      billingCycle: dto.billingCycle,
      customCycleDays: dto.customCycleDays,
      nextRenewal: new Date(dto.nextRenewal),
      category: dto.category,
      reminderEnabled: dto.reminderEnabled ?? true,
      reminderDaysBefore: dto.reminderDaysBefore,
      notes: dto.notes,
    },
  });
}

async findAll(userId: string, query: FindSubscriptionsQueryDto) {
  return this.prisma.subscription.findMany({
    where: {
      userId,
      ...(query.category && { category: query.category }),
      ...(query.status && { status: query.status }),
      ...(query.billingCycle && { billingCycle: query.billingCycle }),
      ...(query.search && {
        name: { contains: query.search, mode: 'insensitive' },
      }),
    },
    orderBy: {
      [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc',
    },
  });
}

  private async findOwned(userId: string, id: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { id, userId },
    });
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    return subscription;
  }

  async findOne(userId: string, id: string) {
    return this.findOwned(userId, id);
  }

  async update(userId: string, id: string, dto: UpdateSubscriptionDto) {
    await this.findOwned(userId, id);
if (dto.householdId !== undefined) {
  if (dto.householdId !== null) {
    const household = await this.prisma.household.findFirst({
      where: { id: dto.householdId, ownerUserId: userId },
    });
    if (!household) {
      throw new ForbiddenException(
        'You can only share a subscription with a household you own',
      );
    }
  }
}
    return this.prisma.subscription.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.billingCycle !== undefined && { billingCycle: dto.billingCycle }),
        ...(dto.customCycleDays !== undefined && { customCycleDays: dto.customCycleDays }),
...(dto.nextRenewal !== undefined && {
  nextRenewal: new Date(dto.nextRenewal),
  lastReminderSentAt: null,
}),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.reminderEnabled !== undefined && { reminderEnabled: dto.reminderEnabled }),
        ...(dto.reminderDaysBefore !== undefined && { reminderDaysBefore: dto.reminderDaysBefore }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.householdId !== undefined && { householdId: dto.householdId }),
      },
    });
  }

  async remove(userId: string, id: string) {
  await this.findOwned(userId, id);
  await this.prisma.$transaction([
    this.prisma.savedEvent.deleteMany({ where: { subscriptionId: id } }),
    this.prisma.subscription.delete({ where: { id } }),
  ]);
  return { message: 'Subscription deleted' };
}

  async cancel(userId: string, id: string) {
    const subscription = await this.findOwned(userId, id);

    const monthlyAmountSaved = normalizeToMonthly(
      Number(subscription.amount),
      subscription.billingCycle,
      subscription.customCycleDays,
    );

    const [updated] = await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id },
        data: { status: 'canceled' },
      }),
      this.prisma.savedEvent.create({
        data: {
          userId,
          subscriptionId: id,
          monthlyAmountSaved,
          canceledAt: new Date(),
        },
      }),
    ]);

    return updated;
  }
  async markAsUsed(userId: string, id: string) {
  await this.findOwned(userId, id);
  return this.prisma.subscription.update({
    where: { id },
    data: { lastUsedDate: new Date() },
  });
}
}