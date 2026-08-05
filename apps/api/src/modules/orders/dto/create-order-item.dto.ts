import { IsNotEmpty, IsNumber, IsUUID, Min } from 'class-validator';

export class CreateOrderItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId!: string;

  @IsNumber()
  @Min(0.001)
  quantidade!: number;

  @IsNumber()
  @Min(0.01)
  precoUnit!: number;
}
