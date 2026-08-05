import { IsNotEmpty, IsNumber, IsString, MaxLength, Min, Max } from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nome!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  categoria!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  unidade!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999999999.99)
  precoReferencia!: number;
}
