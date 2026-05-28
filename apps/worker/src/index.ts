import { closeAllQueues, closeRedisConnection, getRedisConnection } from "@avastudio/queue";
import { createLogger } from "@avastudio/shared";

import { loadWorkerConfig } from "./config.js";
import { startHealthServer } from "./health.js";
import { installGracefulShutdown } from "./shutdown.js";
import { startWorkers } from "./worker.js";

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const logger = createLogger({ level: config.nodeEnv === "production" ? "info" : "debug" });
  const workers = startWorkers(config, logger);
  const healthServer = await startHealthServer({ port: 4001, redis: getRedisConnection(), logger });
  installGracefulShutdown({
    workers,
    healthServer,
    closeConnections: async () => {
      await closeAllQueues();
      await closeRedisConnection();
    },
    logger,
  });
}

void main();
