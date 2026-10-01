import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { FindSubscriptionsQueryDto } from './dto/find-subscriptions-query.dto';
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  create(
    @CurrentUser() user: { userId: string },
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptionsService.create(user.userId, dto);
  }

@Get()
findAll(
  @CurrentUser() user: { userId: string },
  @Query() query: FindSubscriptionsQueryDto,
) {
  return this.subscriptionsService.findAll(user.userId, query);
}


  @Get(':id')
  findOne(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.subscriptionsService.findOne(user.userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.subscriptionsService.remove(user.userId, id);
  }

  @Post(':id/cancel')
  cancel(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.subscriptionsService.cancel(user.userId, id);
  }
  @Post(':id/mark-used')
markAsUsed(
  @CurrentUser() user: { userId: string },
  @Param('id') id: string,
) {
  return this.subscriptionsService.markAsUsed(user.userId, id);
}
}
