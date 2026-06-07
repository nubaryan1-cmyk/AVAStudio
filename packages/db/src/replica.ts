/**
 * Маршрутизация чтение/запись для read replicas (TASK 25.3). Тяжёлые read-запросы
 * (дашборды/аналитика) идут на реплику; запись и read-after-write — на primary.
 * Чистый селектор — соединения внедряются (postgres-js), тестируется без БД.
 */
export type DbRole = "primary" | "replica";

export interface DbRouterOptions {
  /** Есть ли сконфигурированная реплика. Если нет — всё на primary. */
  hasReplica: boolean;
}

export interface QueryIntent {
  /** Запрос только на чтение. */
  readonly: boolean;
  /** Нужна консистентность read-after-write (сразу после мутации) → primary. */
  requireFresh?: boolean;
  /** Тяжёлый аналитический запрос → реплика (если есть). */
  analytical?: boolean;
}

/** Выбирает роль БД для запроса. */
export function pickDbRole(opts: DbRouterOptions, intent: QueryIntent): DbRole {
  if (!opts.hasReplica) return "primary";
  if (!intent.readonly) return "primary";
  if (intent.requireFresh) return "primary";
  if (intent.analytical) return "replica";
  // обычные чтения тоже можно на реплику для разгрузки primary
  return "replica";
}
