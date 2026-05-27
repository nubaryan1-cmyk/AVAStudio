import { z } from "zod";

/**
 * Контур App-secrets (ADR-009): секреты самого приложения.
 * Доступ к ним — ТОЛЬКО через этот модуль. Прямой process.env запрещён ESLint-правилом.
 */

// 32 байта в base64 = 43 символа + '=' (паддинг). Проверяем без декодирования.
const BASE64_32_BYTES = /^[A-Za-z0-9+/]{43}=$/;

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // --- Обязательные (ядро) ---
  DATABASE_URL: z.string().url("DATABASE_URL должен быть валидным URL подключения к Postgres"),
  REDIS_URL: z.string().url("REDIS_URL должен быть валидным URL подключения к Redis"),
  CREDENTIALS_ENCRYPTION_KEY: z
    .string()
    .regex(
      BASE64_32_BYTES,
      "CREDENTIALS_ENCRYPTION_KEY должен быть 32 байтами в base64 (44 символа)",
    ),
  CREDENTIALS_ENCRYPTION_KEY_PREV: z.string().regex(BASE64_32_BYTES).optional(),

  // Пути к бинарям FFmpeg (по умолчанию системные ffmpeg/ffprobe)
  FFMPEG_PATH: z.string().optional(),
  FFPROBE_PATH: z.string().optional(),

  // --- Плейсхолдеры будущих интеграций (опциональны до подключения в Фазе 2) ---
  STRIPE_SECRET_KEY: z.string().optional(),
  CRYPTO_PROVIDER_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  REPLICATE_API_TOKEN: z.string().optional(),
  DUOPLUS_API_KEY: z.string().optional(),
  PROXY_PROVIDER_API_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

function formatIssues(error: z.ZodError): string {
  const lines = error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
  return `Невалидные переменные окружения:\n${lines.join("\n")}`;
}

/** Валидирует серверное окружение. Бросает понятную ошибку при отсутствии/невалидности. */
export function parseServerEnv(source: Record<string, unknown> = process.env): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(formatIssues(result.error));
  }
  return result.data;
}

/** Валидирует клиентское окружение (только NEXT_PUBLIC_*). */
export function parseClientEnv(source: Record<string, unknown> = process.env): ClientEnv {
  const result = clientEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(formatIssues(result.error));
  }
  return result.data;
}

let cachedServer: ServerEnv | null = null;

/** Явная валидация при старте приложения (fail-fast). Вызывать в bootstrap web/worker. */
export function validateServerEnv(): ServerEnv {
  cachedServer ??= parseServerEnv();
  return cachedServer;
}

/**
 * Типобезопасный доступ к серверным секретам. Валидируется лениво при первом обращении,
 * чтобы импорт модуля сам по себе не падал в окружениях без секретов (например, в тестах).
 */
export const env: ServerEnv = new Proxy({} as ServerEnv, {
  get(_target, prop: string) {
    return validateServerEnv()[prop as keyof ServerEnv];
  },
});
