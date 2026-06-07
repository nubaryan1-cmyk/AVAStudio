import { hostname } from "node:os";

import { classifyExit, type ProfileId } from "@avastudio/media";
import { ExternalServiceError, type Logger } from "@avastudio/shared";
import { UnrecoverableError } from "bullmq";

import type { MediaPipeline } from "./pipeline.js";
import type { PlatformValue, ProcessorRepo } from "./repo.js";

/** Контекст, общий для всех процессоров. */
export interface ProcessorContext {
  repo: ProcessorRepo;
  logger: Logger;
  pipeline: MediaPipeline;
  /** Каталог, куда складываются готовые варианты (persisted). */
  outputDir: string;
}

/** Идентификатор воркера для render_metrics (host + pid). */
export function workerId(): string {
  return `${hostname()}#${process.pid}`;
}

/** Детерминированный числовой сид из строки (для воспроизводимой уникализации). */
export function seedFromString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Проверяет exit-код шага FFmpeg. 0 — ок. Иначе по классификации (TASK 6.8):
 * невозвратные коды (например, невалидные данные) → UnrecoverableError (BullMQ не ретраит);
 * транзиентные → ExternalServiceError (BullMQ ретраит по attempts).
 */
export function assertExit(exitCode: number, step: string): void {
  if (exitCode === 0) return;
  const decision = classifyExit(exitCode);
  const message = `${step}: ffmpeg exit ${exitCode} (${decision.reason})`;
  if (!decision.retry) {
    throw new UnrecoverableError(message);
  }
  throw new ExternalServiceError({
    internalMessage: message,
    details: { step, exitCode, reason: decision.reason, adjust: decision.adjust ?? null },
  });
}

/** Маппинг профиля платформы в значение enum `platform`. */
export function profilePlatform(profileId: ProfileId): PlatformValue {
  if (profileId.startsWith("instagram")) return "instagram";
  return profileId as PlatformValue;
}
