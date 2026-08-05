import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
  MaxLength,
} from 'class-validator';
import { IsCnpj } from '../validators/cnpj.validator';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  razaoSocial!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nomeFantasia?: string;

  @IsString()
  @IsNotEmpty()
  @IsCnpj()
  cnpj!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  contato?: string;

  @IsOptional()
  @IsObject()
  endereco?: Record<string, unknown>;
}
