import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDb, type Database } from "@avastudio/db";
import { getRedisConnection, QUEUE_NAMES, type QueueName } from "@avastudio/queue";
import { env } from "@avastudio/shared";
import { Worker } from "bullmq";

import {
  buildProcessors,
  createDbRepo,
  createDefaultPipeline,
  type MediaPipeline,
} from "./processors/index.js";

import type { WorkerConfig } from "./config.js";
import type { Logger } from "@avastudio/shared";

/** Зависимости воркера (инъектируются в тестах вместо реальных БД/FFmpeg). */
export interface WorkerDeps {
  db: Database;
  pipeline: MediaPipeline;
  /** Каталог готовых вариантов. */
  outputDir: string;
}

function defaultDeps(): WorkerDeps {
  return {
    db: createDb(env.DATABASE_URL),
    pipeline: createDefaultPipeline({
      ...(env.FFMPEG_PATH ? { ffmpegPath: env.FFMPEG_PATH } : {}),
      ...(env.FFPROBE_PATH ? { ffprobePath: env.FFPROBE_PATH } : {}),
    }),
    outputDir: join(tmpdir(), "avastudio", "variants"),
  };
}

/**
 * Создаёт по одному BullMQ Worker'у на каждую очередь из реестра.
 * Очереди render-video/unique-media обрабатываются реальными процессорами (TASK 7.4);
 * остальные (постинг/AI/email — ЭТАПЫ 11/12, Фаза 2) пока логируются заглушкой.
 */
export function startWorkers(config: WorkerConfig, logger: Logger, deps?: WorkerDeps): Worker[] {
  const resolved = deps ?? defaultDeps();
  const processors = buildProcessors({
    repo: createDbRepo(resolved.db),
    logger,
    pipeline: resolved.pipeline,
    outputDir: resolved.outputDir,
  });
  const connection = getRedisConnection();

  const workers = QUEUE_NAMES.map((name: QueueName) => {
    const processor = processors[name];
    const worker = new Worker(
      name,
      async (job) => {
        if (processor) {
          return processor(job);
        }
        logger.info({ queue: name, jobId: job.id }, "нет процессора для очереди (заглушка)");
        return undefined;
      },
      { connection, concurrency: config.concurrency },
    );
    worker.on("error", (error) =>
      logger.error({ queue: name, err: error.message }, "ошибка worker"),
    );
    worker.on("failed", (job, error) =>
      logger.error({ queue: name, jobId: job?.id, err: error.message }, "job упал"),
    );
    return worker;
  });

  logger.info(
    {
      queues: QUEUE_NAMES,
      withProcessors: Object.keys(processors),
      concurrency: config.concurrency,
    },
    `worker слушает очереди: ${QUEUE_NAMES.join(", ")}`,
  );
  return workers;
}
