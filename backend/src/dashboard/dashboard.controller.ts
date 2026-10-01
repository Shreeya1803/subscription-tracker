import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: { userId: string }) {
    return this.dashboardService.getSummary(user.userId);
  }

  @Get('unused')
getUnused(@CurrentUser() user: { userId: string }) {
  return this.dashboardService.getUnusedSubscriptions(user.userId);
}
@Get('trends')
getTrends(@CurrentUser() user: { userId: string }) {
  return this.dashboardService.getSpendTrends(user.userId);
}

}
