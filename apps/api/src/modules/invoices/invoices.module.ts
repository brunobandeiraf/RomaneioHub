import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { S3Service } from './s3.service';

@Module({
  imports: [PrismaModule],
  controllers: [InvoicesController],
  providers: [InvoicesService, S3Service],
  exports: [InvoicesService],
})
export class InvoicesModule {}
