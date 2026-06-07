import type { StorageAdapter } from "./local-adapter.js";

/**
 * Supabase Storage адаптер (TASK 16.3). Реализует тот же StorageAdapter-порт, что и
 * LocalStorageAdapter, — медиатека/редактор переключаются без изменения бизнес-кода.
 *
 * Зависит от минимального структурного порта Supabase Storage bucket API (ниже),
 * поэтому тестируем без сети и не привязан к версии SDK. В рантайме передаётся
 * `createClient(url, serviceKey).storage.from(bucket)`.
 */

export interface SupabaseStorageError {
  message: string;
}
export interface SupabaseBucketPort {
  upload(
    path: string,
    body: Uint8Array,
    options?: { upsert?: boolean; contentType?: string },
  ): Promise<{ data: { path: string } | null; error: SupabaseStorageError | null }>;
  download(
    path: string,
  ): Promise<{ data: { arrayBuffer(): Promise<ArrayBuffer> } | null; error: SupabaseStorageError | null }>;
  remove(paths: string[]): Promise<{ data: unknown; error: SupabaseStorageError | null }>;
}

export interface SupabaseStorageOptions {
  bucket: SupabaseBucketPort;
  /** Имя бакета — для формирования storagePath вида `supabase://<bucket>/<key>`. */
  bucketName: string;
  upsert?: boolean;
}

export class SupabaseStorageAdapter implements StorageAdapter {
  private readonly bucket: SupabaseBucketPort;
  private readonly prefix: string;
  private readonly upsert: boolean;

  constructor(options: SupabaseStorageOptions) {
    this.bucket = options.bucket;
    this.prefix = `supabase://${options.bucketName}`;
    this.upsert = options.upsert ?? true;
  }

  private keyOf(storagePath: string): string {
    return storagePath.startsWith(`${this.prefix}/`)
      ? storagePath.slice(this.prefix.length + 1)
      : storagePath;
  }

  async put(key: string, bytes: Uint8Array): Promise<string> {
    const { error } = await this.bucket.upload(key, bytes, { upsert: this.upsert });
    if (error) throw new Error(`Supabase Storage upload: ${error.message}`);
    return `${this.prefix}/${key}`;
  }

  async get(storagePath: string): Promise<Uint8Array | null> {
    const { data, error } = await this.bucket.download(this.keyOf(storagePath));
    if (error || !data) return null;
    return new Uint8Array(await data.arrayBuffer());
  }

  async remove(storagePath: string): Promise<void> {
    const { error } = await this.bucket.remove([this.keyOf(storagePath)]);
    if (error) throw new Error(`Supabase Storage remove: ${error.message}`);
  }
}
