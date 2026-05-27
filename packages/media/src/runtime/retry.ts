export interface RetryDecision {
  retry: boolean;
  reason: string;
  adjust?: "lower-resolution" | "increase-timeout";
}

/**
 * Классификация exit-кода FFmpeg для решения о ретрае:
 * 0 — успех; 137 (OOM) — ретрай с меньшим разрешением; 143 (таймаут) — ретрай с бОльшим таймаутом;
 * 1 (невалидные данные/аргументы) — НЕ ретраить; прочее — транзиентная ошибка, ретрай.
 */
export function classifyExit(exitCode: number): RetryDecision {
  if (exitCode === 0) return { retry: false, reason: "success" };
  if (exitCode === 137) return { retry: true, reason: "oom", adjust: "lower-resolution" };
  if (exitCode === 143) return { retry: true, reason: "timeout", adjust: "increase-timeout" };
  if (exitCode === 1) return { retry: false, reason: "invalid-data" };
  return { retry: true, reason: "transient" };
}

/** Стоит ли повторять попытку (с учётом классификации и номера попытки). */
export function shouldRetry(exitCode: number, attempt: number, maxAttempts = 3): boolean {
  return classifyExit(exitCode).retry && attempt < maxAttempts;
}
