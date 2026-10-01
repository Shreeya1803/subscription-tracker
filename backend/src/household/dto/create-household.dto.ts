import { IsString, MaxLength } from 'class-validator';

export class CreateHouseholdDto {
  @IsString()
  @MaxLength(100)
  name: string;
}
