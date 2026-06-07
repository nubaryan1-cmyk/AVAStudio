// ВАЖНО: импорт телеметрии — ПЕРВЫМ, до queue/db, чтобы OTEL проинструментировал
// http/pg до их загрузки (TASK 8.2).
import "./telemetry.js";

import {
  closeAllQueues,
  closeRedisConnection,
  getQueue,
  getRedisConnection,
  listDLQ,
  QUEUE_NAMES,
} from "@avastudio/queue";
import { createLogger } from "@avastudio/shared";
import { shutdownTelemetry } from "@avastudio/shared/telemetry";

import { loadWorkerConfig } from "./config.js";
import { startHealthServer } from "./health.js";
import {
  MetricsRegistry,
  renderPrometheus,
  type QueueObservation,
  type QueueStatsSource,
} from "./metrics.js";
import { installGracefulShutdown } from "./shutdown.js";
import { startWorkers } from "./worker.js";

/** Источник мгновенных метрик очередей поверх BullMQ (глубина + размер DLQ). */
function createBullStatsSource(): QueueStatsSource {
  return {
    observe: async (): Promise<QueueObservation[]> => {
      const result: QueueObservation[] = [];
      for (const name of QUEUE_NAMES) {
        const c = await getQueue(name).getJobCounts(
          "waiting",
          "active",
          "delayed",
          "completed",
          "failed",
        );
        const dlqSize = (await listDLQ(name, 1000)).length;
        result.push({
          queue: name,
          counts: {
            waiting: c["waiting"] ?? 0,
            active: c["active"] ?? 0,
            delayed: c["delayed"] ?? 0,
            completed: c["completed"] ?? 0,
            failed: c["failed"] ?? 0,
          },
          dlqSize,
        });
      }
      return result;
    },
  };
}

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const logger = createLogger({ level: config.nodeEnv === "production" ? "info" : "debug" });

  const metrics = new MetricsRegistry();
  const workers = startWorkers(config, logger);
  // Наблюдаемость очередей (TASK 8.4): копим latency/fail на событиях воркеров.
  for (const worker of workers) {
    worker.on("completed", (job) => {
      const latency =
        job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 0;
      metrics.recordCompleted(worker.name, latency);
    });
    worker.on("failed", () => metrics.recordFailed(worker.name));
  }

  const statsSource = createBullStatsSource();
  const healthServer = await startHealthServer({
    port: 4001,
    redis: getRedisConnection(),
    logger,
    metricsText: async () => renderPrometheus(metrics, await statsSource.observe()),
  });

  installGracefulShutdown({
    workers,
    healthServer,
    closeConnections: async () => {
      await closeAllQueues();
      await closeRedisConnection();
      await shutdownTelemetry();
    },
    logger,
  });
}

void main();
