import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  // TDD Section 9.5 / FR-12: GET /user/export. Format is JSON -- TDD names
  // the endpoint but never specifies a format (flagged earlier as an open
  // gap). Excludes passwordHash, resetToken, resetTokenExpiry -- never
  // export credentials or reset tokens, even to the account owner.
  async exportData(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
  id: true,
  email: true,
  displayName: true,
  defaultCurrency: true,
  premiumStatus: true,
  pushToken: true,
  createdAt: true,
  updatedAt: true,
},
    });

    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId },
    });

    const savedEvents = await this.prisma.savedEvent.findMany({
      where: { userId },
    });

    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { household: true },
    });

    const paymentEvents = await this.prisma.paymentEvent.findMany({
  where: { userId },
});

    return {
      exportedAt: new Date().toISOString(),
      user,
      subscriptions,
      savedEvents,
      memberships,
      paymentEvents
    };
  }

  // TDD Section 9.5 / FR-12: DELETE /user. Deletes everything the user
  // solely owns, in FK-dependency order, in one transaction.
  // NOTE (flagged, not resolved): does not address what happens to a shared
  // household's other members if the owner deletes their account -- V2
  // functionality with no TDD guidance and no live data yet.
  async deleteAccount(userId: string) {
    const ownedHouseholds = await this.prisma.household.findMany({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    const ownedHouseholdIds = ownedHouseholds.map((h) => h.id);

    await this.prisma.$transaction([
     this.prisma.paymentEvent.deleteMany({ where: { userId } }),
      this.prisma.savedEvent.deleteMany({ where: { userId } }),
      this.prisma.subscription.deleteMany({ where: { userId } }),
      this.prisma.membership.deleteMany({
        where: {
          OR: [
            { userId },
            { householdId: { in: ownedHouseholdIds } },
          ],
        },
      }),
      this.prisma.household.deleteMany({
        where: { id: { in: ownedHouseholdIds } },
      }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);

    return { message: 'Account and all associated data have been deleted.' };
  }
  async registerPushToken(userId: string, pushToken: string) {
  await this.prisma.user.update({
    where: { id: userId },
    data: { pushToken },
  });
  return { message: 'Push token registered' };
}

async getMe(userId: string) {
  return this.prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      defaultCurrency: true,
      premiumStatus: true,
    },
  });
}

}
