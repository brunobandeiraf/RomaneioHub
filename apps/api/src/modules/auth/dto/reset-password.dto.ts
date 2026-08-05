import { IsEmail, IsNotEmpty, IsString, Length, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString()
  @Length(6, 6, { message: 'Verification code must be exactly 6 characters' })
  @IsNotEmpty({ message: 'Verification code is required' })
  code!: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must be at most 128 characters long' })
  @IsNotEmpty({ message: 'New password is required' })
  newPassword!: string;
}
