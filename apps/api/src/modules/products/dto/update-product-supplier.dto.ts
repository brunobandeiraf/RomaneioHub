import { IsNumber, Max, Min } from 'class-validator';

export class UpdateProductSupplierDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999999999.99)
  price!: number;
}
