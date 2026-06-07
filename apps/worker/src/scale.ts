/**
 * Логика авто-масштабирования воркеров по глубине очереди (TASK 18.3).
 * Чистая функция (без сети) — тестируема; рантайм-обвязка (Fly Machines API) — в
 * infrastructure/scale-workers.mjs, использует это решение.
 */

export interface ScaleOptions {
  /** Минимум машин (тёплый пул). */
  min: number;
  /** Максимум машин (потолок стоимости). */
  max: number;
  /** Сколько задач в backlog «обслуживает» одна машина. */
  jobsPerMachine: number;
}

export interface ScaleDecision {
  target: number;
  reason: "min" | "max" | "scale";
}

/**
 * Возвращает целевое число машин для текущей глубины очереди (waiting+active+delayed).
 * Округляем вверх (нужно покрыть backlog), зажимаем в [min, max].
 */
export function decideTargetMachines(depth: number, opts: ScaleOptions): ScaleDecision {
  const per = Math.max(1, opts.jobsPerMachine);
  const needed = Math.ceil(Math.max(0, depth) / per);
  if (needed <= opts.min) return { target: opts.min, reason: "min" };
  if (needed >= opts.max) return { target: opts.max, reason: "max" };
  return { target: needed, reason: "scale" };
}
