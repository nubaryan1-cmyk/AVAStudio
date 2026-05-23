/**
 * Маскирование чувствительных полей перед логированием.
 * Используется как форматтер логов (Pino подключается в Фазе 2, ЭТАП 24).
 * Рекурсивно заменяет значения чувствительных ключей на [REDACTED].
 */

const SENSITIVE_PATTERNS: RegExp[] = [
  /password/i,
  /passwd/i,
  /token/i,
  /cookie/i,
  /secret/i,
  /authorization/i,
  /api[-_]?key/i,
  /_key$/i,
  /^key$/i,
  /credential/i,
  /private[-_]?key/i,
];

export const REDACTED = "[REDACTED]";

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some((re) => re.test(key));
}

function redactInternal(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (seen.has(value)) {
    return "[Circular]";
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactInternal(item, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    result[key] = isSensitiveKey(key) ? REDACTED : redactInternal(val, seen);
  }
  return result;
}

/** Возвращает копию значения с замаскированными чувствительными полями. */
export function redact<T>(value: T): T {
  return redactInternal(value, new WeakSet<object>()) as T;
}

/** Форматтер для Pino (`formatters.log`) — будет подключён в ЭТАП 24. */
export function pinoLogFormatter(object: Record<string, unknown>): Record<string, unknown> {
  return redact(object);
}
