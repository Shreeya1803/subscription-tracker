import { Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RemindersService } from './reminders.service';

// Manual-trigger endpoint for testing the cron logic on demand, since we
// cannot wait a real day to verify scheduled behavior. Not a TDD-specified
// endpoint -- an internal testing/ops tool.
@Controller('reminders')
@UseGuards(JwtAuthGuard)
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Post('run-now')
  runNow() {
    return this.remindersService.processReminders();
  }
}
