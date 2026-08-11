import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('AWS_ENDPOINT');
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';

    this.bucket =
      this.configService.get<string>('S3_BUCKET') || 'invoices-dev';

    this.client = new S3Client({
      region,
      ...(endpoint && {
        endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID') || 'test',
          secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || 'test',
        },
        requestChecksumCalculation: 'WHEN_REQUIRED' as any,
        responseChecksumValidation: 'WHEN_REQUIRED' as any,
      }),
    });
  }

  /**
   * Generate a presigned PUT URL for uploading a file to S3.
   */
  async generatePresignedPutUrl(
    key: string,
    contentType: string,
    expiresIn: number,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    return getSignedUrl(this.client, command, {
      expiresIn,
    });
  }

  /**
   * Generate a presigned GET URL for downloading a file from S3.
   */
  async generatePresignedGetUrl(
    key: string,
    expiresIn: number,
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Upload a file buffer directly to S3.
   */
  async uploadFile(key: string, body: Buffer, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });

    await this.client.send(command);
  }

  /**
   * Delete a file from S3.
   */
  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
  }

  /**
   * Get a readable stream for a file from S3.
   */
  async getFileStream(key: string): Promise<NodeJS.ReadableStream> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.client.send(command);
    return response.Body as NodeJS.ReadableStream;
  }
}
