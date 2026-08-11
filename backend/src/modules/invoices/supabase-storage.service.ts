import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Custom error classes for typed error handling
export class StorageUploadUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageUploadUrlError';
  }
}

export class StorageDownloadUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageDownloadUrlError';
  }
}

export class StorageDeleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageDeleteError';
  }
}

@Injectable()
export class SupabaseStorageService {
  private readonly supabase: SupabaseClient;
  private readonly bucket = 'invoices';
  private readonly logger = new Logger(SupabaseStorageService.name);

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
   * Generates a presigned upload URL for uploading a file to Supabase Storage.
   * The client should PUT the file directly to this URL.
   */
  async createSignedUploadUrl(key: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(key);

    if (error) {
      this.logger.error(`Failed to create signed upload URL for key "${key}": ${error.message}`);
      throw new StorageUploadUrlError(error.message);
    }

    return data.signedUrl;
  }

  /**
   * Generates a presigned download URL for reading a file from Supabase Storage.
   */
  async createSignedUrl(key: string, expiresIn: number): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUrl(key, expiresIn);

    if (error) {
      this.logger.error(`Failed to create signed URL for key "${key}": ${error.message}`);
      throw new StorageDownloadUrlError(error.message);
    }

    return data.signedUrl;
  }

  /**
   * Deletes a file from Supabase Storage.
   */
  async remove(key: string): Promise<void> {
    const { error } = await this.supabase.storage
      .from(this.bucket)
      .remove([key]);

    if (error) {
      this.logger.error(`Failed to delete file with key "${key}": ${error.message}`);
      throw new StorageDeleteError(error.message);
    }
  }
}
