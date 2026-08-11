import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DevAuthService } from './dev-auth.service';
import { CognitoService } from './cognito.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, DevAuthService, CognitoService],
  exports: [AuthService, DevAuthService, CognitoService],
})
export class AuthModule {}
