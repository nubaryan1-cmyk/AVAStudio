import { redact } from "../logger/redact.js";

/**
 * Провайдеро-независимый репортер ошибок (TASK 24.1). В проде — Sentry (web/worker),
 * в тестах — фейк. Контекст (trace_id/user_id/org_id) и scrubbing секретов (redact из
 * ЭТАП 2.4) — здесь, чтобы ни один драйвер не утёк секретами.
 */
export interface ObsContext {
  traceId?: string;
  requestId?: string;
  userId?: string;
  orgId?: string;
}

export interface ErrorReport {
  message: string;
  /** Доп. данные (будут пропущены через redact). */
  extra?: Record<string, unknown>;
  context: ObsContext;
}

/** Порт доставки ошибки в систему мониторинга (Sentry и т.п.). */
export interface ErrorReporter {
  capture(report: ErrorReport): void;
}

/** Чистит контекст и extra от секретов перед отправкой. */
export function scrubReport(
  error: unknown,
  context: ObsContext,
  extra?: Record<string, unknown>,
): ErrorReport {
  const message = error instanceof Error ? error.message : String(error);
  const report: ErrorReport = { message, context: redact(context) };
  if (extra) report.extra = redact(extra);
  return report;
}

/** Безопасно отправляет ошибку: scrub + capture. Никогда не бросает. */
export function reportError(
  reporter: ErrorReporter,
  error: unknown,
  context: ObsContext,
  extra?: Record<string, unknown>,
): void {
  try {
    reporter.capture(scrubReport(error, context, extra));
  } catch {
    // мониторинг не должен ронять бизнес-операцию
  }
}

/** No-op репортер (dev/тесты без Sentry). */
export const noopReporter: ErrorReporter = { capture: () => undefined };
