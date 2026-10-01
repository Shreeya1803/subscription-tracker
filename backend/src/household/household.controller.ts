import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { HouseholdService } from './household.service';
import { CreateHouseholdDto } from './dto/create-household.dto';
import { InviteMemberDto } from './dto/invite-member.dto';

@Controller('households')
@UseGuards(JwtAuthGuard)
export class HouseholdController {
  constructor(private readonly householdService: HouseholdService) {}

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateHouseholdDto,
  ) {
    return this.householdService.create(user.userId, dto);
  }

  @Post(':id/invite')
  invite(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.householdService.invite(user.userId, id, dto);
  }

  @Get(':id')
  getDetail(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.householdService.getDetail(user.userId, id);
  }

  @Get()
listMine(@CurrentUser() user: { userId: string }) {
  return this.householdService.listMine(user.userId);
}
}
