/**
 * Лёгкий in-process нагрузочный харнесс (без внешних зависимостей).
 * Гоняет N виртуальных пользователей через пул ограниченной конкурентности,
 * собирает throughput и перцентили латентности по каждому шагу journey.
 */

/** Детерминированный ГПСЧ (mulberry32) — воспроизводимые прогоны. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LatencyDigest {
  count: number;
  min: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  mean: number;
}

/**
 * Накопитель латентностей (мс). Память ограничена: точные count/sum/min/max,
 * а перцентили считаются по резервуарной выборке фиксированного размера
 * (reservoir sampling), поэтому 1M+ замеров не раздувают heap.
 */
export class LatencyRecorder {
  private readonly reservoir: number[] = [];
  private readonly capacity: number;
  private count = 0;
  private sum = 0;
  private minV = Infinity;
  private maxV = -Infinity;

  constructor(capacity = 50_000) {
    this.capacity = capacity;
  }

  record(ms: number): void {
    this.count += 1;
    this.sum += ms;
    if (ms < this.minV) this.minV = ms;
    if (ms > this.maxV) this.maxV = ms;
    if (this.reservoir.length < this.capacity) {
      this.reservoir.push(ms);
    } else {
      // Алгоритм R: равновероятная замена элемента резервуара.
      const j = Math.floor(Math.random() * this.count);
      if (j < this.capacity) this.reservoir[j] = ms;
    }
  }

  digest(): LatencyDigest {
    const n = this.count;
    if (n === 0) {
      return { count: 0, min: 0, p50: 0, p95: 0, p99: 0, max: 0, mean: 0 };
    }
    const sorted = [...this.reservoir].sort((x, y) => x - y);
    const m = sorted.length;
    const at = (q: number): number => sorted[Math.min(m - 1, Math.floor(q * m))] ?? 0;
    return {
      count: n,
      min: this.minV,
      p50: at(0.5),
      p95: at(0.95),
      p99: at(0.99),
      max: this.maxV,
      mean: this.sum / n,
    };
  }
}

export interface LoadResult {
  totalUsers: number;
  concurrency: number;
  durationMs: number;
  opsTotal: number;
  opsPerSec: number;
  errors: number;
  errorRate: number;
  perStep: Record<string, LatencyDigest>;
}

export interface VuContext {
  /** Индекс виртуального пользователя [0..total). */
  index: number;
  rng: () => number;
  /** Замер одного шага: имя → измеренная латентность. */
  step: <T>(name: string, fn: () => Promise<T> | T) => Promise<T>;
}

/**
 * Запускает `total` виртуальных пользователей с пулом размером `concurrency`.
 * Каждый VU выполняет `journey`. Память ограничивается фиксированным пулом —
 * 1M пользователей НЕ создаёт 1M одновременных промисов.
 */
export async function runLoad(opts: {
  total: number;
  concurrency: number;
  seed?: number;
  journey: (ctx: VuContext) => Promise<void>;
  onProgress?: (done: number, total: number) => void;
}): Promise<LoadResult> {
  const { total, concurrency, journey } = opts;
  const seed = opts.seed ?? 0x9e3779b9;
  const perStep = new Map<string, LatencyRecorder>();
  let opsTotal = 0;
  let errors = 0;
  let done = 0;
  let next = 0;

  const recorderFor = (name: string): LatencyRecorder => {
    let r = perStep.get(name);
    if (!r) {
      r = new LatencyRecorder();
      perStep.set(name, r);
    }
    return r;
  };

  const start = performance.now();

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = next;
      if (index >= total) return;
      next += 1;

      const ctx: VuContext = {
        index,
        rng: mulberry32(seed + index),
        step: async <T>(name: string, fn: () => Promise<T> | T): Promise<T> => {
          const t0 = performance.now();
          try {
            const out = await fn();
            recorderFor(name).record(performance.now() - t0);
            opsTotal += 1;
            return out;
          } catch (e) {
            recorderFor(name).record(performance.now() - t0);
            opsTotal += 1;
            errors += 1;
            throw e;
          }
        },
      };

      try {
        await journey(ctx);
      } catch {
        // ошибка уже учтена в step(); journey завершает VU
      }
      done += 1;
      if (opts.onProgress && done % 50_000 === 0) opts.onProgress(done, total);
    }
  };

  const pool = Array.from({ length: Math.min(concurrency, total) }, () => worker());
  await Promise.all(pool);

  const durationMs = performance.now() - start;
  const perStepOut: Record<string, LatencyDigest> = {};
  for (const [name, rec] of perStep) perStepOut[name] = rec.digest();

  return {
    totalUsers: total,
    concurrency,
    durationMs,
    opsTotal,
    opsPerSec: opsTotal / (durationMs / 1000),
    errors,
    errorRate: opsTotal === 0 ? 0 : errors / opsTotal,
    perStep: perStepOut,
  };
}
