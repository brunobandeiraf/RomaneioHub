import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SecretsService, MANAGED_SECRET_KEYS } from './secrets.service';

// Mock the AWS SDK
jest.mock('@aws-sdk/client-secrets-manager', () => {
  const sendMock = jest.fn();
  return {
    SecretsManagerClient: jest.fn().mockImplementation(() => ({
      send: sendMock,
    })),
    GetSecretValueCommand: jest.fn().mockImplementation((input) => input),
    __sendMock: sendMock,
  };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { __sendMock: sendMock } = require('@aws-sdk/client-secrets-manager');

describe('SecretsService', () => {
  let service: SecretsService;
  let configService: ConfigService;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecretsService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const config: Record<string, string> = {
                AWS_REGION: 'us-east-1',
                NODE_ENV: 'production',
                AWS_SECRET_NAME: 'romaneio-hub/production',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<SecretsService>(SecretsService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('loadSecrets', () => {
    it('should skip loading secrets in non-production environments', async () => {
      jest.spyOn(configService, 'get').mockImplementation(((key: string, defaultValue?: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'AWS_REGION') return 'us-east-1';
        return defaultValue;
      }) as any);

      // Re-create service with updated config
      const module = await Test.createTestingModule({
        providers: [
          SecretsService,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();
      const devService = module.get<SecretsService>(SecretsService);

      await devService.loadSecrets();

      expect(sendMock).not.toHaveBeenCalled();
    });

    it('should load secrets from AWS Secrets Manager in production', async () => {
      const mockSecrets = {
        DATABASE_URL: 'postgresql://prod:pass@rds:5432/db',
        STRIPE_SECRET_KEY: 'sk_live_test123',
        STRIPE_WEBHOOK_SECRET: 'whsec_test123',
        COGNITO_USER_POOL_ID: 'us-east-1_TestPool',
        COGNITO_CLIENT_ID: 'test-client-id',
      };

      sendMock.mockResolvedValueOnce({
        SecretString: JSON.stringify(mockSecrets),
      });

      await service.loadSecrets();

      expect(sendMock).toHaveBeenCalledTimes(1);
      expect(process.env.DATABASE_URL).toBe(mockSecrets.DATABASE_URL);
      expect(process.env.STRIPE_SECRET_KEY).toBe(mockSecrets.STRIPE_SECRET_KEY);
      expect(process.env.STRIPE_WEBHOOK_SECRET).toBe(mockSecrets.STRIPE_WEBHOOK_SECRET);
      expect(process.env.COGNITO_USER_POOL_ID).toBe(mockSecrets.COGNITO_USER_POOL_ID);
      expect(process.env.COGNITO_CLIENT_ID).toBe(mockSecrets.COGNITO_CLIENT_ID);
    });

    it('should throw when SecretString is empty', async () => {
      sendMock.mockResolvedValueOnce({
        SecretString: undefined,
      });

      await expect(service.loadSecrets()).rejects.toThrow(
        'Secret "romaneio-hub/production" has no SecretString value',
      );
    });

    it('should throw when Secrets Manager call fails', async () => {
      sendMock.mockRejectedValueOnce(new Error('Access denied'));

      await expect(service.loadSecrets()).rejects.toThrow('Access denied');
    });

    it('should warn but not throw when a managed key is missing from the secret', async () => {
      const partialSecrets = {
        DATABASE_URL: 'postgresql://prod:pass@rds:5432/db',
        // Other keys intentionally missing
      };

      sendMock.mockResolvedValueOnce({
        SecretString: JSON.stringify(partialSecrets),
      });

      // Should not throw
      await service.loadSecrets();

      expect(process.env.DATABASE_URL).toBe(partialSecrets.DATABASE_URL);
      // Missing keys should not be set
      expect(process.env.STRIPE_SECRET_KEY).toBeUndefined();
    });
  });

  describe('MANAGED_SECRET_KEYS', () => {
    it('should contain the expected secret keys', () => {
      expect(MANAGED_SECRET_KEYS).toContain('DATABASE_URL');
      expect(MANAGED_SECRET_KEYS).toContain('STRIPE_SECRET_KEY');
      expect(MANAGED_SECRET_KEYS).toContain('STRIPE_WEBHOOK_SECRET');
      expect(MANAGED_SECRET_KEYS).toContain('COGNITO_USER_POOL_ID');
      expect(MANAGED_SECRET_KEYS).toContain('COGNITO_CLIENT_ID');
    });
  });
});
