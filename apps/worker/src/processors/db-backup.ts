/**
 * Процессор резервного копирования БД (TASK 16.4). Делает логический дамп Postgres
 * (pg_dump) и складывает в объектное хранилище (R2/S3) с retention-метаданными.
 * PITR (Supabase Pro) — основной механизм; этот дамп — дополнительный пояс безопасности.
 *
 * Тестируемость: внешние эффекты вынесены в порты (DumpRunner, BackupStorage),
 * поэтому unit-тест гоняется без реального Postgres и без сети.
 */

import type { Logger } from "@avastudio/shared";

/** Порт запуска pg_dump. Возвращает байты дампа (gzip). В проде — обёртка над pg_dump. */
export interface DumpRunner {
  dump(connectionString: string): Promise<Uint8Array>;
}

/** Порт хранилища бэкапов (R2/S3). */
export interface BackupStorage {
  put(key: string, bytes: Uint8Array): Promise<void>;
}

export type BackupKind = "daily" | "weekly";

export interface DbBackupContext {
  runner: DumpRunner;
  storage: BackupStorage;
  connectionString: string;
  logger: Logger;
  now?: () => Date;
}

export interface DbBackupResult {
  key: string;
  kind: BackupKind;
  bytes: number;
}

/** Ключ объекта: backups/<kind>/<YYYY-MM-DD>.sql.gz (детерминированно по дате). */
export function backupKey(kind: BackupKind, at: Date): string {
  const day = at.toISOString().slice(0, 10);
  return `backups/${kind}/${day}.sql.gz`;
}

/**
 * Выполняет бэкап. `kind` определяется планировщиком (ежедневный/еженедельный, ЭТАП 5):
 * retention реализуется политиками жизненного цикла бакета (daily→30 дней, weekly→1 год).
 */
export async function runDbBackup(
  ctx: DbBackupContext,
  kind: BackupKind = "daily",
): Promise<DbBackupResult> {
  const at = (ctx.now ?? ((): Date => new Date()))();
  const bytes = await ctx.runner.dump(ctx.connectionString);
  if (bytes.length === 0) {
    throw new Error("db-backup: пустой дамп — pg_dump вернул 0 байт");
  }
  const key = backupKey(kind, at);
  await ctx.storage.put(key, bytes);
  ctx.logger.info({ key, kind, bytes: bytes.length }, "db backup uploaded");
  return { key, kind, bytes: bytes.length };
}
