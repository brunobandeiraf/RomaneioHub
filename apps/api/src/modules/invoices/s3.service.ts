import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
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

    return getSignedUrl(this.client, command, { expiresIn });
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
}
