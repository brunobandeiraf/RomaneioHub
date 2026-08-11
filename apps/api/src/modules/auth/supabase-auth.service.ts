import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Typed Error Classes ──────────────────────────────────────────────────────

export class AuthEmailAlreadyExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthEmailAlreadyExistsError';
  }
}

export class AuthInvalidCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthInvalidCodeError';
  }
}

export class AuthExpiredCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthExpiredCodeError';
  }
}

export class AuthInvalidCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthInvalidCredentialsError';
  }
}

export class AuthUserNotConfirmedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthUserNotConfirmedError';
  }
}

export class AuthInvalidTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthInvalidTokenError';
  }
}

export class AuthUserNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthUserNotFoundError';
  }
}

// ─── Result Interfaces ────────────────────────────────────────────────────────

export interface AuthSignUpResult {
  authId: string;
  codeDeliveryDestination: string;
}

export interface AuthSignInResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class SupabaseAuthService {
  private readonly supabase: SupabaseClient;
  private readonly logger = new Logger(SupabaseAuthService.name);

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.getOrThrow<string>('SUPABASE_SERVICE_ROLE_KEY');

    this.supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  /**
   * Register a new user via Supabase Auth Admin API.
   * Supabase sends the confirmation email automatically.
   */
  async signUp(email: string, password: string, name: string): Promise<AuthSignUpResult> {
    const { data, error } = await this.supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { name },
    });

    if (error) {
      this.logger.error(`Supabase signUp failed for ${email}: ${error.message}`);

      // Supabase returns this message when email already exists
      if (
        error.message.toLowerCase().includes('already registered') ||
        error.message.toLowerCase().includes('already exists') ||
        error.message.toLowerCase().includes('email address is already taken') ||
        error.code === 'email_exists'
      ) {
        throw new AuthEmailAlreadyExistsError('An account with this email already exists');
      }

      throw error;
    }

    return {
      authId: data.user.id,
      codeDeliveryDestination: email,
    };
  }

  /**
   * Confirm user email via OTP token sent to their email.
   */
  async confirmOtp(email: string, token: string): Promise<void> {
    const { error } = await this.supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (error) {
      this.logger.warn(`OTP verification failed for ${email}: ${error.message}`);

      if (error.message.toLowerCase().includes('expired') || error.code === 'otp_expired') {
        throw new AuthExpiredCodeError('The verification code has expired. Please request a new one');
      }

      throw new AuthInvalidCodeError('The verification code is invalid');
    }
  }

  /**
   * Sign in with email and password.
   * Returns access token, refresh token and expiry.
   */
  async signIn(email: string, password: string): Promise<AuthSignInResult> {
    const { data, error } = await this.supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      this.logger.warn(`SignIn failed for ${email}: ${error.message}`);

      if (
        error.message.toLowerCase().includes('email not confirmed') ||
        error.code === 'email_not_confirmed'
      ) {
        throw new AuthUserNotConfirmedError(
          'Account not confirmed. Please check your email for the confirmation code',
        );
      }

      // Invalid credentials — includes wrong password and user not found
      throw new AuthInvalidCredentialsError('Invalid email or password');
    }

    const session = data.session!;

    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresIn: session.expires_in,
    };
  }

  /**
   * Trigger a password reset email.
   * Never throws — returns silently even if the email doesn't exist (prevents enumeration).
   */
  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    await this.supabase.auth.resetPasswordForEmail(email, { redirectTo });
    // Intentionally swallow errors to prevent email enumeration
  }

  /**
   * Update user password using a valid access token (from password reset link).
   */
  async confirmPasswordReset(accessToken: string, newPassword: string): Promise<void> {
    // Create a user-scoped client to update the password
    const supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');
    const anonKey = this.configService.getOrThrow<string>('SUPABASE_ANON_KEY');

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    });

    const { error } = await userClient.auth.updateUser({ password: newPassword });

    if (error) {
      this.logger.warn(`Password reset failed: ${error.message}`);
      throw new AuthInvalidTokenError('Password reset token is invalid or expired');
    }
  }

  /**
   * Delete a user from Supabase Auth (used for rollback on transaction failure).
   */
  async deleteUser(authId: string): Promise<void> {
    const { error } = await this.supabase.auth.admin.deleteUser(authId);

    if (error) {
      if (error.message.toLowerCase().includes('not found') || error.code === 'user_not_found') {
        throw new AuthUserNotFoundError(`User with authId "${authId}" not found`);
      }
      throw error;
    }
  }
}
