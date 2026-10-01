import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

@Injectable()
export class HouseholdService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateHouseholdDto) {
    return this.prisma.$transaction(async (tx) => {
      const household = await tx.household.create({
        data: { name: dto.name, ownerUserId: userId },
      });
      await tx.membership.create({
        data: { householdId: household.id, userId, role: 'owner' },
      });
      return household;
    });
  }

  // Scoped access check: user must have a membership row (owner or member)
  // for this household. Same ownership-scoping pattern used throughout --
  // a non-member gets an identical 404 whether the household id is wrong
  // or just not theirs.
  private async requireMembership(userId: string, householdId: string) {
    const membership = await this.prisma.membership.findFirst({
      where: { householdId, userId },
    });
    if (!membership) {
      throw new NotFoundException('Household not found');
    }
    return membership;
  }

  async invite(userId: string, householdId: string, dto: InviteMemberDto) {
    const membership = await this.requireMembership(userId, householdId);
    if (membership.role !== 'owner') {
      throw new ForbiddenException('Only the household owner can invite members');
    }

    const invitee = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!invitee) {
      throw new NotFoundException(
        'No account exists with that email. They need to sign up first.',
      );
    }

    const existing = await this.prisma.membership.findFirst({
      where: { householdId, userId: invitee.id },
    });
    if (existing) {
      throw new ConflictException('This user is already a member of the household');
    }

    return this.prisma.membership.create({
      data: { householdId, userId: invitee.id, role: 'member' },
    });
  }

  async getDetail(userId: string, householdId: string) {
    await this.requireMembership(userId, householdId);

    const household = await this.prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      include: {
        memberships: {
          include: {
            user: {
              select: { id: true, email: true, displayName: true },
            },
          },
        },
        subscriptions: true,
      },
    });

    return household;
  }
  async listMine(userId: string) {
  const memberships = await this.prisma.membership.findMany({
    where: { userId },
    include: { household: true },
  });

  return memberships.map((m) => ({
    ...m.household,
    role: m.role,
  }));
}

}
