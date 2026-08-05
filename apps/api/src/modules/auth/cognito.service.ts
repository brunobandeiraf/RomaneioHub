import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  AuthFlowType,
  UsernameExistsException,
  CodeMismatchException,
  ExpiredCodeException,
  NotAuthorizedException,
  UserNotConfirmedException,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';

export interface CognitoAuthResult {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}

export interface CognitoSignUpResult {
  userSub: string;
  codeDeliveryDestination?: string;
}

@Injectable()
export class CognitoService {
  private readonly client: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly clientId: string;
  private readonly logger = new Logger(CognitoService.name);

  constructor(private readonly configService: ConfigService) {
    this.userPoolId = this.configService.getOrThrow<string>('COGNITO_USER_POOL_ID');
    this.clientId = this.configService.getOrThrow<string>('COGNITO_CLIENT_ID');

    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const endpoint = this.configService.get<string>('AWS_ENDPOINT');

    this.client = new CognitoIdentityProviderClient({
      region,
      ...(endpoint && { endpoint }),
    });
  }

  /**
   * Register a new user in Cognito.
   * Cognito will send a confirmation email with a verification code.
   */
  async signUp(
    email: string,
    password: string,
    name: string,
  ): Promise<CognitoSignUpResult> {
    try {
      const command = new SignUpCommand({
        ClientId: this.clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'name', Value: name },
        ],
      });

      const response = await this.client.send(command);

      return {
        userSub: response.UserSub!,
        codeDeliveryDestination: response.CodeDeliveryDetails?.Destination,
      };
    } catch (error) {
      if (error instanceof UsernameExistsException) {
        throw new CognitoEmailAlreadyExistsError(
          'An account with this email already exists',
        );
      }
      this.logger.error('Cognito signUp failed', error);
      throw error;
    }
  }

  /**
   * Confirm a user's email with the verification code.
   */
  async confirmSignUp(email: string, code: string): Promise<void> {
    try {
      const command = new ConfirmSignUpCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
      });

      await this.client.send(command);
    } catch (error) {
      if (error instanceof CodeMismatchException) {
        throw new CognitoInvalidCodeError('The verification code is invalid');
      }
      if (error instanceof ExpiredCodeException) {
        throw new CognitoExpiredCodeError(
          'The verification code has expired. Please request a new one',
        );
      }
      this.logger.error('Cognito confirmSignUp failed', error);
      throw error;
    }
  }

  /**
   * Authenticate a user and return JWT tokens.
   * Access token expires in 1 hour, refresh token in 30 days.
   */
  async initiateAuth(
    email: string,
    password: string,
  ): Promise<CognitoAuthResult> {
    try {
      const command = new InitiateAuthCommand({
        ClientId: this.clientId,
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });

      const response = await this.client.send(command);
      const result = response.AuthenticationResult;

      if (!result) {
        throw new Error('Authentication result is empty');
      }

      return {
        accessToken: result.AccessToken!,
        refreshToken: result.RefreshToken!,
        idToken: result.IdToken!,
        expiresIn: result.ExpiresIn!,
      };
    } catch (error) {
      if (error instanceof NotAuthorizedException) {
        throw new CognitoInvalidCredentialsError(
          'Invalid email or password',
        );
      }
      if (error instanceof UserNotConfirmedException) {
        throw new CognitoUserNotConfirmedError(
          'Account not confirmed. Please check your email for the confirmation code',
        );
      }
      if (error instanceof UserNotFoundException) {
        throw new CognitoInvalidCredentialsError(
          'Invalid email or password',
        );
      }
      this.logger.error('Cognito initiateAuth failed', error);
      throw error;
    }
  }

  /**
   * Send a password recovery code to the user's email.
   * Code is valid for 15 minutes.
   */
  async forgotPassword(email: string): Promise<string | undefined> {
    try {
      const command = new ForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
      });

      const response = await this.client.send(command);
      return response.CodeDeliveryDetails?.Destination;
    } catch (error) {
      if (error instanceof UserNotFoundException) {
        // Don't reveal whether the email exists — return silently
        return undefined;
      }
      this.logger.error('Cognito forgotPassword failed', error);
      throw error;
    }
  }

  /**
   * Reset the user's password using the verification code.
   */
  async confirmForgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<void> {
    try {
      const command = new ConfirmForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
      });

      await this.client.send(command);
    } catch (error) {
      if (error instanceof CodeMismatchException) {
        throw new CognitoInvalidCodeError(
          'The verification code is invalid',
        );
      }
      if (error instanceof ExpiredCodeException) {
        throw new CognitoExpiredCodeError(
          'The verification code has expired. Please request a new code',
        );
      }
      this.logger.error('Cognito confirmForgotPassword failed', error);
      throw error;
    }
  }
}

// Custom error classes for typed error handling in the auth service

export class CognitoEmailAlreadyExistsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CognitoEmailAlreadyExistsError';
  }
}

export class CognitoInvalidCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CognitoInvalidCodeError';
  }
}

export class CognitoExpiredCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CognitoExpiredCodeError';
  }
}

export class CognitoInvalidCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CognitoInvalidCredentialsError';
  }
}

export class CognitoUserNotConfirmedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CognitoUserNotConfirmedError';
  }
}
