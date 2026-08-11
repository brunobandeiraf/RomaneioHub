import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../prisma';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DevAuthService } from './dev-auth.service';
import { SupabaseAuthService } from './supabase-auth.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, DevAuthService, SupabaseAuthService],
  exports: [AuthService, DevAuthService, SupabaseAuthService],
})
export class AuthModule {}
