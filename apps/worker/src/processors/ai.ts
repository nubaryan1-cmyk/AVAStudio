/**
 * AI-процессоры очередей ai-image / ai-video / ai-audio (TASK 11.5). Гоняют запрос
 * через провайдеро-независимый реестр (11.1–11.4) с fallback + rate-limit per provider
 * (поверх resilience-политики aiPolicy, ЭТАП 8), считают estimated_cost и пишут в
 * ai_usage. Фаза 1 — mock-провайдеры, без реальных ключей. Результаты возвращаются
 * (запись в media_assets выполняет инфраструктурный слой в Фазе 2).
 */
import { jobSchemas, type JobData } from "@avastudio/queue";
import {
  estimateCost,
  generateAudio,
  generateImage,
  submitVideo,
  type AiUsageRepository,
  type AiProviderRegistry,
  type ProviderRateLimiter,
} from "@avastudio/shared/ai";

import type { OrgId } from "@avastudio/shared";
import type { Logger } from "@avastudio/shared";
import type { Job } from "bullmq";

/** Контекст AI-процессоров (инъектируется; в тестах — mock-реестр + in-memory usage). */
export interface AiProcessorContext {
  registry: AiProviderRegistry;
  usageRepo: AiUsageRepository;
  rateLimiter: ProviderRateLimiter;
  logger: Logger;
}

export interface AiImageResult {
  provider: string;
  imageUrls: string[];
}

/** Процессор очереди `ai-image`. */
export function createAiImageProcessor(ctx: AiProcessorContext) {
  return async function aiImage(job: Job): Promise<AiImageResult> {
    const data: JobData<"ai-image"> = jobSchemas["ai-image"].parse(job.data);
    const req = { prompt: data.prompt, ...(data.size !== undefined ? { size: data.size } : {}) };
    const result = await ctx.rateLimiter.run("ai-image", () => generateImage(ctx.registry, req));
    const { provider, value } = { provider: result.providerUsed, value: result.value };
    const outputSize = value.images.length;
    await ctx.usageRepo.record({
      orgId: data.orgId as OrgId,
      provider,
      model: value.meta.model,
      useCase: "image",
      inputSize: data.prompt.length,
      outputSize,
      estimatedCost: estimateCost({ provider, model: value.meta.model, inputSize: data.prompt.length, outputSize }),
      latencyMs: value.meta.latencyMs,
      occurredAt: new Date(),
    });
    ctx.logger.info({ queue: "ai-image", jobId: job.id, provider, images: outputSize }, "AI image готов");
    return { provider, imageUrls: value.images.map((a) => a.url) };
  };
}

export interface AiVideoResult {
  provider: string;
  jobId: string;
  state: string;
}

/** Процессор очереди `ai-video`. Submit задачи (poll/результат — отдельный шаг/poll). */
export function createAiVideoProcessor(ctx: AiProcessorContext) {
  return async function aiVideo(job: Job): Promise<AiVideoResult> {
    const data: JobData<"ai-video"> = jobSchemas["ai-video"].parse(job.data);
    const req = {
      prompt: data.prompt,
      ...(data.durationSec !== undefined ? { durationSec: data.durationSec } : {}),
    };
    const result = await ctx.rateLimiter.run("ai-video", () => submitVideo(ctx.registry, req));
    const handle = result.value;
    const outputSize = data.durationSec ?? 0;
    await ctx.usageRepo.record({
      orgId: data.orgId as OrgId,
      provider: handle.provider,
      model: `${handle.provider}-v1`,
      useCase: "video",
      inputSize: data.prompt.length,
      outputSize,
      estimatedCost: estimateCost({ provider: handle.provider, model: `${handle.provider}-v1`, inputSize: data.prompt.length, outputSize }),
      latencyMs: 0,
      occurredAt: new Date(),
    });
    ctx.logger.info({ queue: "ai-video", jobId: job.id, provider: handle.provider, videoJob: handle.jobId }, "AI video submitted");
    return { provider: handle.provider, jobId: handle.jobId, state: handle.state };
  };
}

export interface AiAudioResult {
  provider: string;
  audioUrl: string;
  durationSec: number | undefined;
}

/** Процессор очереди `ai-audio` (TTS). */
export function createAiAudioProcessor(ctx: AiProcessorContext) {
  return async function aiAudio(job: Job): Promise<AiAudioResult> {
    const data: JobData<"ai-audio"> = jobSchemas["ai-audio"].parse(job.data);
    const req = { text: data.prompt, ...(data.voice !== undefined ? { voice: data.voice } : {}) };
    const result = await ctx.rateLimiter.run("ai-audio", () => generateAudio(ctx.registry, req));
    const value = result.value;
    await ctx.usageRepo.record({
      orgId: data.orgId as OrgId,
      provider: result.providerUsed,
      model: value.meta.model,
      useCase: "audio",
      inputSize: data.prompt.length,
      outputSize: value.audio.durationSec ?? 0,
      estimatedCost: estimateCost({ provider: result.providerUsed, model: value.meta.model, inputSize: data.prompt.length, outputSize: value.audio.durationSec ?? 0 }),
      latencyMs: value.meta.latencyMs,
      occurredAt: new Date(),
    });
    ctx.logger.info({ queue: "ai-audio", jobId: job.id, provider: result.providerUsed }, "AI audio готов");
    return { provider: result.providerUsed, audioUrl: value.audio.url, durationSec: value.audio.durationSec };
  };
}
