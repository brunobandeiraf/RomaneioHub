import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { validatePasswordStrength } from '../../shared/index';
import { TenantRole } from '../../shared/index';
import { PrismaService } from '../../prisma';
import {
  SupabaseAuthService,
  AuthEmailAlreadyExistsError,
  AuthInvalidCodeError,
  AuthExpiredCodeError,
  AuthInvalidCredentialsError,
  AuthUserNotConfirmedError,
  AuthInvalidTokenError,
} from './supabase-auth.service';
import { RegisterDto, ConfirmDto, LoginDto, ForgotPasswordDto, ResetPasswordDto, InviteDto, AcceptInviteDto } from './dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseAuthService: SupabaseAuthService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Register a new Seller account.
   * Creates the user in Supabase Auth (sends confirmation email)
   * and stores the user + tenant + association in the database.
   */
  async register(dto: RegisterDto) {
    // Validate password strength using shared validator
    const passwordValidation = validatePasswordStrength(dto.password);
    if (!passwordValidation.valid) {
      throw new BadRequestException(passwordValidation.errors);
    }

    let authResult: Awaited<ReturnType<SupabaseAuthService['signUp']>> | null = null;

    try {
      // Create user in Supabase Auth — will send confirmation email
      authResult = await this.supabaseAuthService.signUp(
        dto.email,
        dto.password,
        dto.name,
      );

      // Create Tenant and User in the database
      const result = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: dto.companyName,
          },
        });

        const user = await tx.user.create({
          data: {
            authId: authResult!.authId,
            email: dto.email,
            name: dto.name,
            globalRole: 'SELLER',
          },
        });

        await tx.userTenant.create({
          data: {
            userId: user.id,
            tenantId: tenant.id,
            role: 'SELLER',
            status: 'PENDING',
          },
        });

        return { user, tenant };
      });

      return {
        message: 'Registration successful. Please check your email for the confirmation code.',
        userId: result.user.id,
        tenantId: result.tenant.id,
        codeDeliveryDestination: authResult.codeDeliveryDestination,
      };
    } catch (error) {
      if (error instanceof AuthEmailAlreadyExistsError) {
        throw new ConflictException('An account with this email already exists');
      }

      // Rollback: if Supabase user was created but DB transaction failed, delete the auth user
      if (authResult && !(error instanceof ConflictException)) {
        try {
          await this.supabaseAuthService.deleteUser(authResult.authId);
        } catch (rollbackError) {
          this.logger.error(
            `Failed to rollback Supabase user ${authResult.authId}: ${(rollbackError as Error).message}`,
          );
        }
      }

      throw error;
    }
  }

  /**
   * Confirm a user's email with the verification code.
   * Activates the user's account and their tenant association.
   */
  async confirm(dto: ConfirmDto) {
    try {
      await this.supabaseAuthService.confirmOtp(dto.email, dto.code);

      // Activate the user's tenant association
      const user = await this.prisma.user.findUnique({
        where: { email: dto.email },
        include: { tenants: true },
      });

      if (user) {
        await this.prisma.userTenant.updateMany({
          where: {
            userId: user.id,
            status: 'PENDING',
          },
          data: {
            status: 'ACCEPTED',
            acceptedAt: new Date(),
          },
        });
      }

      return {
        message: 'Email confirmed successfully. You can now log in.',
      };
    } catch (error) {
      if (error instanceof AuthInvalidCodeError) {
        throw new BadRequestException('The verification code is invalid');
      }
      if (error instanceof AuthExpiredCodeError) {
        throw new BadRequestException(
          'The verification code has expired. Please request a new one',
        );
      }
      throw error;
    }
  }

  /**
   * Authenticate a user and return JWT tokens.
   * Returns access token, refresh token and expiry.
   */
  async login(dto: LoginDto) {
    try {
      const tokens = await this.supabaseAuthService.signIn(
        dto.email,
        dto.password,
      );

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        tokenType: 'Bearer',
      };
    } catch (error) {
      if (error instanceof AuthInvalidCredentialsError) {
        throw new UnauthorizedException('Invalid email or password');
      }
      if (error instanceof AuthUserNotConfirmedError) {
        throw new UnauthorizedException(
          'Account not confirmed. Please check your email for the confirmation code',
        );
      }
      throw error;
    }
  }

  /**
   * Send a password recovery link to the user's email.
   * Always returns success to prevent email enumeration.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    await this.supabaseAuthService.requestPasswordReset(dto.email, frontendUrl + '/reset-password');

    return {
      message:
        'If an account with this email exists, a password reset link has been sent.',
    };
  }

  /**
   * Reset password using the access token from the reset link.
   * Validates the new password against the strong password policy.
   */
  async resetPassword(dto: ResetPasswordDto) {
    // Validate new password strength
    const passwordValidation = validatePasswordStrength(dto.newPassword);
    if (!passwordValidation.valid) {
      throw new BadRequestException(passwordValidation.errors);
    }

    try {
      await this.supabaseAuthService.confirmPasswordReset(
        dto.accessToken,
        dto.newPassword,
      );

      return {
        message: 'Password reset successfully. You can now log in with your new password.',
      };
    } catch (error) {
      if (error instanceof AuthInvalidTokenError) {
        throw new BadRequestException('Password reset token is invalid or expired');
      }
      throw error;
    }
  }

  /**
   * Invite an accountant to a tenant.
   * The seller sends an invitation with a specified accounting role.
   * Generates a unique token valid for 48 hours.
   */
  async inviteAccountant(sellerId: string, tenantId: string, dto: InviteDto) {
    // Validate that only accounting roles can be invited
    const allowedRoles: TenantRole[] = [TenantRole.ACCOUNTING_MANAGER, TenantRole.ACCOUNTING_VIEWER];
    if (!allowedRoles.includes(dto.role)) {
      throw new BadRequestException('Role must be ACCOUNTING_MANAGER or ACCOUNTING_VIEWER');
    }

    // Verify the inviter is a SELLER in this tenant
    const inviterTenant = await this.prisma.userTenant.findFirst({
      where: {
        userId: sellerId,
        tenantId,
        role: 'SELLER',
        status: 'ACCEPTED',
      },
    });

    if (!inviterTenant) {
      throw new ForbiddenException('Only sellers can invite accountants');
    }

    // Find or create user record for the invited email
    let invitedUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!invitedUser) {
      invitedUser = await this.prisma.user.create({
        data: {
          authId: `pending-${randomUUID()}`,
          email: dto.email,
          name: dto.email.split('@')[0],
          globalRole: 'SELLER',
        },
      });
    }

    // Check if there's already an association for this user+tenant
    const existingAssociation = await this.prisma.userTenant.findUnique({
      where: {
        userId_tenantId: {
          userId: invitedUser.id,
          tenantId,
        },
      },
    });

    // Generate invitation token and expiry (48 hours)
    const invitationToken = randomUUID();
    const invitationExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    if (existingAssociation) {
      // Update existing association with new invitation
      await this.prisma.userTenant.update({
        where: { id: existingAssociation.id },
        data: {
          role: dto.role,
          status: 'PENDING',
          invitationToken,
          invitationExpiresAt,
          acceptedAt: null,
        },
      });
    } else {
      // Create new UserTenant association
      await this.prisma.userTenant.create({
        data: {
          userId: invitedUser.id,
          tenantId,
          role: dto.role,
          status: 'PENDING',
          invitationToken,
          invitationExpiresAt,
        },
      });
    }

    // Build invitation link
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const invitationLink = `${frontendUrl}/accept-invite?token=${invitationToken}`;

    this.logger.log(`Invitation sent to ${dto.email} for tenant ${tenantId} with role ${dto.role}`);

    return {
      message: 'Invitation sent successfully.',
      invitationLink,
      token: invitationToken,
      expiresAt: invitationExpiresAt,
    };
  }

  /**
   * Accept an invitation using the token.
   * Validates the token is not expired and not already used.
   *
   * Invited users are created (in inviteAccountant) with a placeholder
   * authId, since no Supabase Auth account exists for them yet. Accepting
   * the invite is what actually provisions that account — the invitation
   * link, sent to and clicked from the invitee's inbox, is what proves
   * email ownership, standing in for the usual OTP confirmation step.
   */
  async acceptInvitation(dto: AcceptInviteDto) {
    const passwordValidation = validatePasswordStrength(dto.password);
    if (!passwordValidation.valid) {
      throw new BadRequestException(passwordValidation.errors);
    }

    const userTenant = await this.prisma.userTenant.findFirst({
      where: {
        invitationToken: dto.token,
      },
      include: { user: true },
    });

    if (!userTenant) {
      throw new BadRequestException('Invitation link is no longer valid');
    }

    // Check if invitation has already been accepted
    if (userTenant.status === 'ACCEPTED') {
      throw new BadRequestException('Invitation has already been used');
    }

    // Check if invitation has expired
    if (!userTenant.invitationExpiresAt || new Date() > userTenant.invitationExpiresAt) {
      throw new BadRequestException('Invitation link is no longer valid');
    }

    // Provision the real Supabase Auth account on first acceptance. If this
    // user already accepted a different tenant's invite before, they already
    // have a real account (and password) — skip straight to accepting.
    if (userTenant.user.authId.startsWith('pending-')) {
      try {
        const authResult = await this.supabaseAuthService.signUpConfirmed(
          userTenant.user.email,
          dto.password,
          userTenant.user.name,
        );

        await this.prisma.user.update({
          where: { id: userTenant.user.id },
          data: { authId: authResult.authId },
        });
      } catch (error) {
        if (error instanceof AuthEmailAlreadyExistsError) {
          throw new ConflictException(
            'An account with this email already exists. Please log in and ask to be re-invited.',
          );
        }
        throw error;
      }
    }

    // Accept the invitation
    await this.prisma.userTenant.update({
      where: { id: userTenant.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        invitationToken: null,
        invitationExpiresAt: null,
      },
    });

    return {
      message: 'Invitation accepted successfully. You can now log in.',
    };
  }
}
