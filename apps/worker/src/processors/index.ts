
import {
  InMemoryAiUsageRepository,
  ProviderRateLimiter,
  createMockImageProvider,
  createMockMusicProvider,
  createMockTtsProvider,
  createMockVideoProvider,
  createRegistry,
} from "@avastudio/shared/ai";

import { createAiAudioProcessor, createAiImageProcessor, createAiVideoProcessor } from "./ai.js";
import { createRenderVideoProcessor } from "./render-video.js";
import { createUniqueMediaProcessor } from "./unique-media.js";
import { createPhoneTaskProcessor } from "./phone.js";

import type { AiProcessorContext } from "./ai.js";
import type { ProcessorContext } from "./shared.js";
import type { QueueName } from "@avastudio/queue";
import type { Logger } from "@avastudio/shared";
import type { Job } from "bullmq";

export * from "./pipeline.js";
export * from "./repo.js";
export * from "./ai.js";
export type { ProcessorContext } from "./shared.js";

export type JobProcessor = (job: Job) => Promise<unknown>;

/**
 * Дефолтный AI-контекст для Фазы 1: реестр mock-провайдеров (без ключей) + in-memory
 * ai_usage + rate-limit per provider. В Фазе 2 заменяется реальными драйверами и
 * БД-репозиторием ai_usage без изменения процессоров.
 */
export function defaultAiContext(logger: Logger): AiProcessorContext {
  return {
    registry: createRegistry({
      image: [createMockImageProvider({ name: "mock-image" })],
      video: [createMockVideoProvider({ name: "mock-video" })],
      audio: [createMockTtsProvider({ name: "mock-tts" })],
      music: [createMockMusicProvider({ name: "mock-music" })],
    }),
    usageRepo: new InMemoryAiUsageRepository(),
    rateLimiter: new ProviderRateLimiter(2),
    logger,
  };
}

/**
 * Строит реестр процессоров по имени очереди. render/unique — медиа-пайплайн (ЭТАП 7);
 * ai-image/ai-video/ai-audio — провайдеро-независимые AI-процессоры (ЭТАП 11, Фаза 1 mock).
 * Остальные (постинг/email — ЭТАП 12, Фаза 2) в worker.ts логируются заглушкой.
 */
export function buildProcessors(
  ctx: ProcessorContext,
  aiCtx: AiProcessorContext = defaultAiContext(ctx.logger),
): Partial<Record<QueueName, JobProcessor>> {
  return {
    "render-video": createRenderVideoProcessor(ctx),
    "unique-media": createUniqueMediaProcessor(ctx),
    "phone-task": createPhoneTaskProcessor(ctx.logger),
    "ai-image": createAiImageProcessor(aiCtx),
    "ai-video": createAiVideoProcessor(aiCtx),
    "ai-audio": createAiAudioProcessor(aiCtx),
  };
}
