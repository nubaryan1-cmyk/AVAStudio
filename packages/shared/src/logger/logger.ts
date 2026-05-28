import { pino, type DestinationStream, type Logger } from "pino";
export type { Logger } from "pino";

import { redact } from "./redact.js";

export interface CreateLoggerOptions {
  level?: string;
  /** Кастомный поток для тестов; по умолчанию stdout. */
  destination?: DestinationStream;
}

/**
 * Pino-логгер с redact-форматтером: каждое логируемое поле проходит redact()
 * перед сериализацией → пароли/токены/cookies/секреты маскируются как `[REDACTED]`.
 * Транспорт (Axiom) подключается в Фазе 2 (ЭТАП 24.2).
 */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  return pino(
    {
      level: options.level ?? "info",
      formatters: {
        log: (obj) => redact(obj) as Record<string, unknown>,
      },
    },
    options.destination,
  );
}
