import {
  IsString,
  IsNumber,
  IsPositive,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsDateString,
  Matches,
  MaxLength,
} from 'class-validator';
import { BillingCycle, Category } from '../../../generated/prisma/enums';
import { IsValidCustomCycleDays } from '../validators/custom-cycle-days.validator';

export class CreateSubscriptionDto {
  @IsString()
  @MaxLength(200)
  name: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO 4217 code' })
  currency: string;

  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  
  @IsValidCustomCycleDays()
  customCycleDays?: number;

  @IsDateString()
  nextRenewal: string;

  @IsEnum(Category)
  category: Category;

  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @IsInt()
  @Min(0)
  @Max(365)
  reminderDaysBefore: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
@IsString()
householdId?: string;

}
