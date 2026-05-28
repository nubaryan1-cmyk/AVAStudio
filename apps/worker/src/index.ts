import { closeAllQueues, closeRedisConnection } from "@avastudio/queue";
import { createLogger } from "@avastudio/shared";

import { loadWorkerConfig } from "./config.js";
import { startWorkers } from "./worker.js";

const config = loadWorkerConfig();
const logger = createLogger({ level: config.nodeEnv === "production" ? "info" : "debug" });
const workers = startWorkers(config, logger);

// Минимальная остановка для dev. Полный graceful shutdown — TASK 7.2.
async function stop(): Promise<void> {
  logger.info("остановка worker'а");
  await Promise.all(workers.map((w) => w.close()));
  await closeAllQueues();
  await closeRedisConnection();
  process.exit(0);
}
process.on("SIGTERM", () => void stop());
process.on("SIGINT", () => void stop());
