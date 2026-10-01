import { Controller, Delete, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserService } from './user.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { Body } from '@nestjs/common';
import { Post } from '@nestjs/common';
@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('export')
  exportData(@CurrentUser() user: { userId: string }) {
    return this.userService.exportData(user.userId);
  }

  @Delete()
  deleteAccount(@CurrentUser() user: { userId: string }) {
    return this.userService.deleteAccount(user.userId);
  }
  @Post('push-token')
registerPushToken(
  @CurrentUser() user: { userId: string },
  @Body() dto: RegisterPushTokenDto,
) {
  return this.userService.registerPushToken(user.userId, dto.pushToken);
}

@Get('me')
getMe(@CurrentUser() user: { userId: string }) {
  return this.userService.getMe(user.userId);
}
}
