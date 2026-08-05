import {
  IsDateString,
  IsNotEmpty,
  IsUUID,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateOrderItemDto } from './create-order-item.dto';

export class CreateOrderDto {
  @IsUUID()
  @IsNotEmpty()
  supplierId!: string;

  @IsDateString()
  @IsNotEmpty()
  date!: string;

  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  items!: CreateOrderItemDto[];
}
