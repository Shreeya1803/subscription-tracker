import { IsOptional, IsEnum, IsString, IsIn } from 'class-validator';
import { BillingCycle, Category, SubscriptionStatus } from '../../../generated/prisma/enums';

const SORTABLE_FIELDS = ['name', 'amount', 'nextRenewal', 'createdAt'] as const;
type SortableField = typeof SORTABLE_FIELDS[number];

export class FindSubscriptionsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsEnum(Category)
  category?: Category;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @IsOptional()
  @IsIn(SORTABLE_FIELDS)
  sortBy?: SortableField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
