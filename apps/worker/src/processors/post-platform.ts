/**
 * Процессоры постинг-очередей post-instagram/tiktok/reddit/threads (TASK 12.7).
 * Берут posting_job, проверяют идемпотентность (не постить дважды), логинятся через
 * провайдеро-независимый драйвер платформы (12.4) и публикуют видео. Фаза 1 — mock
 * (драйверы возвращают детерминированный результат). Реальный постинг — Фаза 2.
 */
import { jobSchemas, type JobData } from "@avastudio/queue";
import { getPlatform, type SocialRegistry } from "@avastudio/shared/social";

import type { Logger, SocialAccountId } from "@avastudio/shared";
import type { Platform, PostResult } from "@avastudio/shared/social";
import type { Job } from "bullmq";

/** Очереди постинга (зеркало имён очередей post-*). */
export type PostingQueue = "post-instagram" | "post-tiktok" | "post-reddit" | "post-threads";

const QUEUE_PLATFORM: Record<PostingQueue, Platform> = {
  "post-instagram": "instagram",
  "post-tiktok": "tiktok",
  "post-reddit": "reddit",
  "post-threads": "threads",
};

/** Репозиторий идемпотентности постинга (зеркало posting_jobs.status). */
export interface PostedJobRepository {
  isPosted(postingJobId: string): Promise<boolean>;
  markPosted(postingJobId: string, result: PostResult): Promise<void>;
}

/** In-memory реализация для Фазы 1/тестов. */
export class InMemoryPostedJobRepository implements PostedJobRepository {
  private readonly posted = new Map<string, PostResult>();

  async isPosted(postingJobId: string): Promise<boolean> {
    return this.posted.has(postingJobId);
  }

  async markPosted(postingJobId: string, result: PostResult): Promise<void> {
    this.posted.set(postingJobId, result);
  }
}

export interface PostProcessorContext {
  registry: SocialRegistry;
  postedRepo: PostedJobRepository;
  logger: Logger;
}

export interface PostOutcome {
  postingJobId: string;
  skipped: boolean;
  result?: PostResult;
}

/** Создаёт процессор постинга для конкретной очереди/платформы. */
export function createPostProcessor(queue: PostingQueue, ctx: PostProcessorContext) {
  const platform = QUEUE_PLATFORM[queue];
  return async function postPlatform(job: Job): Promise<PostOutcome> {
    const data: JobData<typeof queue> = jobSchemas[queue].parse(job.data);
    // Идемпотентность: если этот posting_job уже опубликован — не постим повторно.
    if (await ctx.postedRepo.isPosted(data.postingJobId)) {
      ctx.logger.info({ queue, jobId: job.id, postingJobId: data.postingJobId }, "Пропуск: уже опубликовано");
      return { postingJobId: data.postingJobId, skipped: true };
    }
    const driver = getPlatform(ctx.registry, platform);
    const account = {
      accountId: data.accountId as SocialAccountId,
      platform,
      handle: `acc-${data.accountId.slice(0, 8)}`,
    };
    const session = await driver.login(account);
    const result = await driver.postVideo(
      session,
      { kind: "video", path: data.assetId },
      data.caption !== undefined ? { caption: data.caption } : undefined,
    );
    if (result.ok) {
      await ctx.postedRepo.markPosted(data.postingJobId, result);
    }
    ctx.logger.info(
      { queue, jobId: job.id, postingJobId: data.postingJobId, ok: result.ok, mechanism: result.mechanism },
      "Постинг выполнен (mock)",
    );
    return { postingJobId: data.postingJobId, skipped: false, result };
  };
}
