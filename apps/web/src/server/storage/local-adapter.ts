/**
 * Локальный адаптер хранилища (Фаза 1).
 * Облачное Storage (S3/R2) — Фаза 2. Здесь — in-memory + детерминированный путь.
 */

export interface StorageAdapter {
  /** Сохраняет байты и возвращает storagePath. */
  put(key: string, bytes: Uint8Array): Promise<string>;
  /** Возвращает байты по пути или null. */
  get(storagePath: string): Promise<Uint8Array | null>;
  /** Удаляет объект. */
  remove(storagePath: string): Promise<void>;
}

export class LocalStorageAdapter implements StorageAdapter {
  private readonly prefix: string;
  private readonly blobs = new Map<string, Uint8Array>();

  constructor(prefix = "local://media") {
    this.prefix = prefix;
  }

  async put(key: string, bytes: Uint8Array): Promise<string> {
    const storagePath = `${this.prefix}/${key}`;
    this.blobs.set(storagePath, bytes);
    return storagePath;
  }

  async get(storagePath: string): Promise<Uint8Array | null> {
    return this.blobs.get(storagePath) ?? null;
  }

  async remove(storagePath: string): Promise<void> {
    this.blobs.delete(storagePath);
  }
}
