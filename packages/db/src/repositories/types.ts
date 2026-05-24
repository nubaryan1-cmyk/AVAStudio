import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/**
 * Драйверо-независимый тип drizzle-БД (postgres-js в проде, pglite в тестах).
 * Используется во всех репозиториях.
 */
export type Db = PgDatabase<PgQueryResultHKT, typeof import("../schema/index.js")>;
