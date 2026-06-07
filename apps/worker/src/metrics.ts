/**
 * Queue observability (TASK 8.4). Сбор метрик очередей и рендер в формат
 * Prometheus для эндпоинта `/metrics` воркера. Без внешних зависимостей —
 * счётчики в памяти процесса + мгновенный снимок состояния очередей.
 */

/** Счётчики BullMQ по очереди. */
export interface QueueCounts {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
}

/** Наблюдение по одной очереди: счётчики + размер её DLQ. */
export interface QueueObservation {
  queue: string;
  counts: QueueCounts;
  dlqSize: number;
}

/** Источник мгновенных метрик очередей (реальный — поверх BullMQ; в тестах — фейк). */
export interface QueueStatsSource {
  observe(): Promise<QueueObservation[]>;
}

/**
 * Реестр накопительных метрик воркера: обновляется на событиях completed/failed.
 * Latency агрегируется как сумма+счётчик (для среднего); гистограммы — ЭТАП 24.
 */
export class MetricsRegistry {
  private readonly completed = new Map<string, number>();
  private readonly failed = new Map<string, number>();
  private readonly latencySumMs = new Map<string, number>();
  private readonly latencyCount = new Map<string, number>();

  private static inc(map: Map<string, number>, key: string, by = 1): void {
    map.set(key, (map.get(key) ?? 0) + by);
  }

  /** Успешная обработка job'а с замером latency. */
  recordCompleted(queue: string, latencyMs: number): void {
    MetricsRegistry.inc(this.completed, queue);
    MetricsRegistry.inc(this.latencySumMs, queue, latencyMs);
    MetricsRegistry.inc(this.latencyCount, queue);
  }

  /** Падение job'а (после исчерпания ретраев BullMQ). */
  recordFailed(queue: string): void {
    MetricsRegistry.inc(this.failed, queue);
  }

  completedTotal(queue: string): number {
    return this.completed.get(queue) ?? 0;
  }
  failedTotal(queue: string): number {
    return this.failed.get(queue) ?? 0;
  }
  /** Средняя latency обработки, мс (0, если замеров не было). */
  avgLatencyMs(queue: string): number {
    const count = this.latencyCount.get(queue) ?? 0;
    if (count === 0) return 0;
    return (this.latencySumMs.get(queue) ?? 0) / count;
  }
  /** Доля падений [0..1] = failed / (failed + completed). */
  failRate(queue: string): number {
    const f = this.failedTotal(queue);
    const total = f + this.completedTotal(queue);
    return total === 0 ? 0 : f / total;
  }
}

function metricLine(name: string, queue: string, value: number): string {
  return `${name}{queue="${queue}"} ${value}`;
}

/**
 * Рендерит метрики в текстовый формат Prometheus: глубина очередей, активные,
 * completed/failed totals, fail rate, средняя latency, размер DLQ.
 */
export function renderPrometheus(
  registry: MetricsRegistry,
  observations: QueueObservation[],
): string {
  const lines: string[] = [];

  lines.push("# HELP avastudio_queue_depth Ожидающие job'ы (waiting+delayed)");
  lines.push("# TYPE avastudio_queue_depth gauge");
  for (const o of observations) {
    lines.push(metricLine("avastudio_queue_depth", o.queue, o.counts.waiting + o.counts.delayed));
  }

  lines.push("# HELP avastudio_queue_active Активно обрабатываемые job'ы");
  lines.push("# TYPE avastudio_queue_active gauge");
  for (const o of observations) {
    lines.push(metricLine("avastudio_queue_active", o.queue, o.counts.active));
  }

  lines.push("# HELP avastudio_jobs_completed_total Успешно обработанные job'ы");
  lines.push("# TYPE avastudio_jobs_completed_total counter");
  for (const o of observations) {
    lines.push(metricLine("avastudio_jobs_completed_total", o.queue, registry.completedTotal(o.queue)));
  }

  lines.push("# HELP avastudio_jobs_failed_total Упавшие job'ы (после ретраев)");
  lines.push("# TYPE avastudio_jobs_failed_total counter");
  for (const o of observations) {
    lines.push(metricLine("avastudio_jobs_failed_total", o.queue, registry.failedTotal(o.queue)));
  }

  lines.push("# HELP avastudio_jobs_fail_rate Доля падений [0..1]");
  lines.push("# TYPE avastudio_jobs_fail_rate gauge");
  for (const o of observations) {
    lines.push(metricLine("avastudio_jobs_fail_rate", o.queue, registry.failRate(o.queue)));
  }

  lines.push("# HELP avastudio_job_latency_ms_avg Средняя latency обработки, мс");
  lines.push("# TYPE avastudio_job_latency_ms_avg gauge");
  for (const o of observations) {
    lines.push(metricLine("avastudio_job_latency_ms_avg", o.queue, registry.avgLatencyMs(o.queue)));
  }

  lines.push("# HELP avastudio_dlq_size Размер dead-letter-очереди");
  lines.push("# TYPE avastudio_dlq_size gauge");
  for (const o of observations) {
    lines.push(metricLine("avastudio_dlq_size", o.queue, o.dlqSize));
  }

  return `${lines.join("\n")}\n`;
}
