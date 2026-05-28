import { getRedisConnection, QUEUE_NAMES, type QueueName } from "@avastudio/queue";
import { Worker } from "bullmq";

import type { WorkerConfig } from "./config.js";
import type { Logger } from "@avastudio/shared";

/**
 * Создаёт по одному BullMQ Worker'у на каждую очередь из реестра.
 * Реальные процессоры (рендер/постинг) — TASK 7.4. Здесь пока заглушка-логирование.
 */
export function startWorkers(config: WorkerConfig, logger: Logger): Worker[] {
  const connection = getRedisConnection();
  const workers = QUEUE_NAMES.map((name: QueueName) => {
    const worker = new Worker(
      name,
      (job) => {
        logger.info({ queue: name, jobId: job.id }, "получен job (процессор будет в TASK 7.4)");
        return Promise.resolve();
      },
      { connection, concurrency: config.concurrency },
    );
    worker.on("error", (error) =>
      logger.error({ queue: name, err: error.message }, "ошибка worker"),
    );
    return worker;
  });
  logger.info(
    { queues: QUEUE_NAMES, concurrency: config.concurrency },
    `worker слушает очереди: ${QUEUE_NAMES.join(", ")}`,
  );
  return workers;
}
