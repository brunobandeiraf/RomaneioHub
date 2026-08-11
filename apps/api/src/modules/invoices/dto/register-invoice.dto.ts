import { IsString, IsNumber, Max, IsIn, IsOptional, IsEnum } from 'class-validator';
import {
  ALLOWED_INVOICE_CONTENT_TYPES,
  MAX_INVOICE_FILE_SIZE,
} from '@romaneio-hub/shared';

export enum InvoiceCategoryDto {
  PURCHASE = 'PURCHASE',
  COLLECTION = 'COLLECTION',
  WAYBILL = 'WAYBILL',
}

export class RegisterInvoiceDto {
  @IsString()
  filename!: string;

  @IsString()
  s3Key!: string;

  @IsString()
  @IsIn([...ALLOWED_INVOICE_CONTENT_TYPES])
  contentType!: string;

  @IsNumber()
  @Max(MAX_INVOICE_FILE_SIZE)
  sizeBytes!: number;

  @IsOptional()
  @IsEnum(InvoiceCategoryDto)
  category?: InvoiceCategoryDto;
}
