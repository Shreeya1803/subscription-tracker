import { Body, Controller, Headers, HttpCode, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BillingService } from './billing.service';

@Controller()
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** Called by RevenueCat. Protected by the Authorization header configured in the RevenueCat dashboard. */
  @Post('webhooks/revenuecat')
  @HttpCode(200)
  webhook(@Headers('authorization') authorization: string | undefined, @Body() body: Record<string, unknown>) {
    return this.billing.handleWebhook(authorization, body);
  }

  /** Called by the app after a purchase or restore, so Premium unlocks without waiting for the webhook. */
  @Post('billing/sync')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  sync(@CurrentUser() user: { userId: string }) {
    return this.billing.syncUser(user.userId);
  }
}