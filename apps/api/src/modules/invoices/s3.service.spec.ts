import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { S3Service } from './s3.service';

// Mock AWS SDK modules
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({})),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://presigned-url.example.com'),
}));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

describe('S3Service', () => {
  let service: S3Service;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                AWS_ENDPOINT: 'http://localhost:4566',
                AWS_REGION: 'us-east-1',
                S3_BUCKET: 'invoices-dev',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
  });

  describe('generatePresignedPutUrl', () => {
    it('should generate a presigned PUT URL with correct parameters', async () => {
      const key = 'notas-fiscais/tenant-1/order-1/file.pdf';
      const contentType = 'application/pdf';
      const expiresIn = 900;

      const result = await service.generatePresignedPutUrl(
        key,
        contentType,
        expiresIn,
      );

      expect(result).toBe('https://presigned-url.example.com');
      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'invoices-dev',
        Key: key,
        ContentType: contentType,
      });
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: {
            Bucket: 'invoices-dev',
            Key: key,
            ContentType: contentType,
          },
        }),
        { expiresIn },
      );
    });
  });

  describe('generatePresignedGetUrl', () => {
    it('should generate a presigned GET URL with correct parameters', async () => {
      const key = 'notas-fiscais/tenant-1/order-1/file.pdf';
      const expiresIn = 900;

      const result = await service.generatePresignedGetUrl(key, expiresIn);

      expect(result).toBe('https://presigned-url.example.com');
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'invoices-dev',
        Key: key,
      });
      expect(getSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          input: {
            Bucket: 'invoices-dev',
            Key: key,
          },
        }),
        { expiresIn },
      );
    });
  });
});
