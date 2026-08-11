import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import { TenantRole } from '@romaneio-hub/shared';
import { RequestUser } from '../../common/interfaces';
import { AuthService } from './auth.service';
import { DevAuthService } from './dev-auth.service';
import {
  RegisterDto,
  ConfirmDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  InviteDto,
  AcceptInviteDto,
} from './dto';

@Controller('auth')
export class AuthController {
  private readonly isDev: boolean;

  constructor(
    private readonly authService: AuthService,
    private readonly devAuthService: DevAuthService,
    private readonly configService: ConfigService,
  ) {
    this.isDev = this.configService.get('NODE_ENV') !== 'production';
  }

  /**
   * Register a new Seller account.
   * Sends a confirmation email with a 24-hour activation link.
   */
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * Confirm email with the verification code.
   * Activates the account after successful confirmation.
   */
  @Public()
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  async confirm(@Body() dto: ConfirmDto) {
    return this.authService.confirm(dto);
  }

  /**
   * Login with email and password.
   * Returns JWT tokens (access 1h, refresh 30d) with tenant_id and role claims.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    // In development, use local DB authentication (bypasses Cognito)
    if (this.isDev) {
      return this.devAuthService.login(dto.email, dto.password);
    }
    return this.authService.login(dto);
  }

  /**
   * Request a password reset.
   * Sends a 6-digit verification code valid for 15 minutes.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * Reset password using the verification code.
   * Requires a new password conforming to the strong password policy.
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * Invite an accountant to the seller's tenant.
   * Sends an invitation with a single-use link valid for 48 hours.
   */
  @Roles(TenantRole.SELLER)
  @Post('invite')
  @HttpCode(HttpStatus.OK)
  async invite(
    @CurrentUser() user: RequestUser,
    @Body() dto: InviteDto,
  ) {
    return this.authService.inviteAccountant(user.userId, user.tenantId, dto);
  }

  /**
   * Accept an invitation using the token from the invitation link.
   * This is a public endpoint — no auth required, validated by the token.
   */
  @Public()
  @Post('accept-invite')
  @HttpCode(HttpStatus.OK)
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvitation(dto);
  }
}
