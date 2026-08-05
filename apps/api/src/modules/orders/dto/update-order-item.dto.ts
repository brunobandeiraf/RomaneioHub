import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateOrderItemDto {
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  quantidade?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  precoUnit?: number;
}
