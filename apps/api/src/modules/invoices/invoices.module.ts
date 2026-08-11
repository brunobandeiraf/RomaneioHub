import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { SupabaseStorageService } from './supabase-storage.service';

@Module({
  imports: [PrismaModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, SupabaseStorageService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
