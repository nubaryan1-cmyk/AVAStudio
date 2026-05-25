import { uuidSchema } from "@avastudio/shared";
import { z } from "zod";

import type { JobsOptions } from "bullmq";

/** Общая схема постинг-job (для всех платформенных очередей). */
const postingJobSchema = z.object({
  orgId: uuidSchema,
  postingJobId: uuidSchema,
  accountId: uuidSchema,
  assetId: uuidSchema,
  caption: z.string().optional(),
});

/** Zod-схемы данных для каждой очереди. Ключи = имена очередей. */
export const jobSchemas = {
  "render-video": z.object({
    orgId: uuidSchema,
    contentJobId: uuidSchema,
    sourceAssetId: uuidSchema,
    preset: z.record(z.string(), z.unknown()).optional(),
  }),
  "unique-media": z.object({
    orgId: uuidSchema,
    sourceAssetId: uuidSchema,
    variants: z.number().int().min(1).max(100),
  }),
  "post-instagram": postingJobSchema,
  "post-tiktok": postingJobSchema,
  "post-reddit": postingJobSchema,
  "post-threads": postingJobSchema,
  "warmup-account": z.object({ orgId: uuidSchema, accountId: uuidSchema }),
  "scrape-stats": z.object({ orgId: uuidSchema, accountId: uuidSchema }),
  "ai-image": z.object({
    orgId: uuidSchema,
    prompt: z.string().min(1),
    size: z.string().optional(),
  }),
  "ai-video": z.object({
    orgId: uuidSchema,
    prompt: z.string().min(1),
    durationSec: z.number().int().positive().optional(),
  }),
  "ai-audio": z.object({
    orgId: uuidSchema,
    prompt: z.string().min(1),
    voice: z.string().optional(),
  }),
  "send-email": z.object({
    to: z.string().email(),
    template: z.string().min(1),
    data: z.record(z.string(), z.unknown()).optional(),
  }),
} as const;

export type QueueName = keyof typeof jobSchemas;
export type JobData<Q extends QueueName> = z.infer<(typeof jobSchemas)[Q]>;

export const QUEUE_NAMES = Object.keys(jobSchemas) as QueueName[];

/** Дефолтные опции job'ов: 3 попытки, экспоненциальный backoff, очистка истории. */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: 1000,
  removeOnFail: 5000,
};
