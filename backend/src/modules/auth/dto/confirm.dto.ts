import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class ConfirmDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Confirmation code is required' })
  code!: string;
}
