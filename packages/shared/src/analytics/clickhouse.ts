/**
 * ClickHouse аналитический warehouse (TASK 25.4). Загрузка аналитических событий батчами
 * через очередь, не блокируя основной поток. Клиент — структурный порт (в проде —
 * @clickhouse/client; в тестах — фейк). Транзакционные данные не дублируем без нужды.
 */
export const ANALYTICS_TABLES = ["posting_metrics", "usage_events", "render_metrics", "ai_usage", "account_health"] as const;
export type AnalyticsTable = (typeof ANALYTICS_TABLES)[number];

export interface AnalyticsRow {
  [column: string]: string | number | boolean;
}

/** Порт вставки в ClickHouse. */
export interface ClickHouseClient {
  insert(table: AnalyticsTable, rows: AnalyticsRow[]): Promise<void>;
}

export interface BatchLoaderOptions {
  client: ClickHouseClient;
  /** Размер батча — флаш при достижении. */
  batchSize?: number;
}

/**
 * Батч-загрузчик: накапливает строки по таблице и флашит пачками. Вызывается консумером
 * очереди событий. flush() — для финализации/таймера.
 */
export class ClickHouseBatchLoader {
  private readonly client: ClickHouseClient;
  private readonly batchSize: number;
  private readonly buffers = new Map<AnalyticsTable, AnalyticsRow[]>();

  constructor(options: BatchLoaderOptions) {
    this.client = options.client;
    this.batchSize = options.batchSize ?? 500;
  }

  async add(table: AnalyticsTable, row: AnalyticsRow): Promise<void> {
    const buf = this.buffers.get(table) ?? [];
    buf.push(row);
    this.buffers.set(table, buf);
    if (buf.length >= this.batchSize) await this.flushTable(table);
  }

  private async flushTable(table: AnalyticsTable): Promise<void> {
    const buf = this.buffers.get(table);
    if (!buf || buf.length === 0) return;
    this.buffers.set(table, []);
    await this.client.insert(table, buf);
  }

  /** Флашит все накопленные батчи (по таймеру/при остановке). */
  async flush(): Promise<void> {
    for (const table of this.buffers.keys()) await this.flushTable(table);
  }

  pending(table: AnalyticsTable): number {
    return this.buffers.get(table)?.length ?? 0;
  }
}
