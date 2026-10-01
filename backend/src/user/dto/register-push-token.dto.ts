import { IsString } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  pushToken: string;
}
