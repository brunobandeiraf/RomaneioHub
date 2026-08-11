import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

/**
 * Secret keys managed by AWS Secrets Manager in production.
 * In development, these are loaded from .env via ConfigModule.
 */
export const MANAGED_SECRET_KEYS = [
  'DATABASE_URL',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'COGNITO_USER_POOL_ID',
  'COGNITO_CLIENT_ID',
] as const;

export type ManagedSecretKey = (typeof MANAGED_SECRET_KEYS)[number];

@Injectable()
export class SecretsService {
  private readonly logger = new Logger(SecretsService.name);
  private readonly client: SecretsManagerClient;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.client = new SecretsManagerClient({ region });
  }

  /**
   * Loads secrets from AWS Secrets Manager and injects them into process.env.
   * Only runs in production. In development, ConfigModule handles .env loading.
   */
  async loadSecrets(): Promise<void> {
    const nodeEnv = this.configService.get<string>('NODE_ENV');

    if (nodeEnv !== 'production') {
      this.logger.log(
        'Non-production environment detected — skipping Secrets Manager',
      );
      return;
    }

    const secretName = this.configService.get<string>(
      'AWS_SECRET_NAME',
      'romaneio-hub/production',
    );

    this.logger.log(
      `Loading secrets from AWS Secrets Manager (secret: ${secretName})`,
    );

    try {
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await this.client.send(command);

      if (!response.SecretString) {
        throw new Error(
          `Secret "${secretName}" has no SecretString value`,
        );
      }

      const secrets: Record<string, string> = JSON.parse(
        response.SecretString,
      );

      for (const key of MANAGED_SECRET_KEYS) {
        if (secrets[key]) {
          process.env[key] = secrets[key];
        } else {
          this.logger.warn(
            `Secret key "${key}" not found in Secrets Manager`,
          );
        }
      }

      this.logger.log('Secrets loaded successfully from AWS Secrets Manager');
    } catch (error) {
      this.logger.error(
        `Failed to load secrets from AWS Secrets Manager: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
