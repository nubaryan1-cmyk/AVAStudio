import type { UserId } from "../domain/ids.js";

/**
 * Связка сессии с RLS (TASK 10.1). Политики БД используют `app.current_user_id`
 * (см. packages/db RLS). На каждый запрос от имени пользователя нужно установить это GUC.
 */

/** UUID-формат userId (защита от инъекции в SET). */
const UUID_RE = /^[0-9a-fA-F-]{1,64}$/;

/** SQL для установки контекста пользователя в текущей сессии БД. */
export function rlsContextSql(userId: UserId): string {
  if (!UUID_RE.test(userId)) {
    throw new Error("rlsContextSql: некорректный userId");
  }
  return `SET app.current_user_id = '${userId}'`;
}

/** SQL для сброса контекста (анонимная сессия). */
export function rlsResetSql(): string {
  return `SET app.current_user_id = ''`;
}

/** Применяет RLS-контекст через переданный исполнитель (Db.exec и т.п.). */
export async function applyRlsContext(
  exec: (sql: string) => Promise<unknown>,
  userId: UserId | null,
): Promise<void> {
  await exec(userId ? rlsContextSql(userId) : rlsResetSql());
}
