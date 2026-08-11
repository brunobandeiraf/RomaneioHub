import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must be at most 128 characters long' })
  @IsNotEmpty({ message: 'Password is required' })
  password!: string;

  @IsString()
  @IsNotEmpty({ message: 'Name is required' })
  @MaxLength(200, { message: 'Name must be at most 200 characters' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: 'Company name is required' })
  @MaxLength(200, { message: 'Company name must be at most 200 characters' })
  companyName!: string;
}
