import { Queue, Worker } from "bullmq";

import { closeRedisConnection, getRedisConnection } from "./connection.js";

/**
 * Smoke-тест BullMQ: добавляем job в очередь, worker его обрабатывает.
 * Запуск: pnpm queue:smoke (требует запущенного Redis: pnpm redis:up).
 */
async function main(): Promise<void> {
  const connection = getRedisConnection();
  const queue = new Queue("smoke", { connection });

  const processed = new Promise<void>((resolve, reject) => {
    const worker = new Worker(
      "smoke",
      (job) => {
        console.log(`Обработан job "${job.name}":`, job.data);
        return Promise.resolve();
      },
      { connection },
    );
    worker.on("completed", () => {
      void worker.close().then(resolve);
    });
    worker.on("failed", (_job, error) => reject(error));
  });

  await queue.add("ping", { hello: "world" });
  await processed;
  await queue.close();
  await closeRedisConnection();
  console.log("Smoke OK: job добавлен и обработан");
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
