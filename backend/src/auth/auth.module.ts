import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ResetPasswordPageController } from './reset-password-page.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [PassportModule, JwtModule.register({}), EmailModule],
  controllers: [AuthController, ResetPasswordPageController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
