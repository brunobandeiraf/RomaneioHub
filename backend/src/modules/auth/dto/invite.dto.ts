import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';
import { TenantRole } from '../../../shared/index';

export class InviteDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email!: string;

  @IsEnum([TenantRole.ACCOUNTING_MANAGER, TenantRole.ACCOUNTING_VIEWER], {
    message: 'Role must be ACCOUNTING_MANAGER or ACCOUNTING_VIEWER',
  })
  @IsNotEmpty({ message: 'Role is required' })
  role!: TenantRole;
}
