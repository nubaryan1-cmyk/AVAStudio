import type { StorageAdapter } from "./local-adapter.js";

/**
 * Cloudflare R2 storage адаптер (TASK 25.1). Реализует тот же StorageAdapter-порт, что и
 * local/supabase — медиатека переключается без изменения бизнес-кода. R2 = S3-совместимый
 * API с НУЛЕВЫМ egress (отдача через CDN дёшево). HTTP-операции через структурный порт
 * S3BucketPort (в проде — @aws-sdk/client-s3 на R2 endpoint; в тестах — фейк).
 */
export interface S3PutInput {
  key: string;
  body: Uint8Array;
  contentType?: string;
}
export interface S3BucketPort {
  put(input: S3PutInput): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

export interface R2Options {
  bucket: S3BucketPort;
  bucketName: string;
  /** Публичный CDN-домен для построения URL отдачи (r2.dev / кастомный). */
  cdnBaseUrl?: string;
}

export class R2StorageAdapter implements StorageAdapter {
  private readonly bucket: S3BucketPort;
  private readonly prefix: string;
  private readonly cdnBaseUrl: string | undefined;

  constructor(options: R2Options) {
    this.bucket = options.bucket;
    this.prefix = `r2://${options.bucketName}`;
    this.cdnBaseUrl = options.cdnBaseUrl;
  }

  private keyOf(storagePath: string): string {
    return storagePath.startsWith(`${this.prefix}/`) ? storagePath.slice(this.prefix.length + 1) : storagePath;
  }

  /** Публичный CDN-URL для ключа (если задан cdnBaseUrl). */
  publicUrl(storagePath: string): string | null {
    return this.cdnBaseUrl ? `${this.cdnBaseUrl.replace(/\/$/, "")}/${this.keyOf(storagePath)}` : null;
  }

  async put(key: string, bytes: Uint8Array): Promise<string> {
    await this.bucket.put({ key, body: bytes });
    return `${this.prefix}/${key}`;
  }

  async get(storagePath: string): Promise<Uint8Array | null> {
    return this.bucket.get(this.keyOf(storagePath));
  }

  async remove(storagePath: string): Promise<void> {
    await this.bucket.delete(this.keyOf(storagePath));
  }
}
