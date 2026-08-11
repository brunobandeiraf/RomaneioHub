import { IsString, IsNumber, Max, IsIn } from 'class-validator';
import {
  ALLOWED_INVOICE_CONTENT_TYPES,
  MAX_INVOICE_FILE_SIZE,
} from '../../../shared/index';

export class UploadUrlRequestDto {
  @IsString()
  filename!: string;

  @IsString()
  @IsIn([...ALLOWED_INVOICE_CONTENT_TYPES])
  contentType!: string;

  @IsNumber()
  @Max(MAX_INVOICE_FILE_SIZE)
  sizeBytes!: number;
}
