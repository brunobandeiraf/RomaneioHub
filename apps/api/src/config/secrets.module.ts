import { Global, Module, OnModuleInit } from '@nestjs/common';
import { SecretsService } from './secrets.service';

/**
 * Global module that loads secrets from AWS Secrets Manager at application startup.
 * In production, secrets are fetched and injected into process.env before other
 * modules initialize their connections (e.g., database, Stripe).
 *
 * In development, this module is a no-op — secrets come from .env via ConfigModule.
 */
@Global()
@Module({
  providers: [SecretsService],
  exports: [SecretsService],
})
export class SecretsModule implements OnModuleInit {
  constructor(private readonly secretsService: SecretsService) {}

  async onModuleInit(): Promise<void> {
    await this.secretsService.loadSecrets();
  }
}
