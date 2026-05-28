import { env } from "@avastudio/shared";

export interface WorkerConfig {
  concurrency: number;
  nodeEnv: string;
  redisUrl: string;
}

/** Загружает конфиг воркера из типизированного env. */
export function loadWorkerConfig(): WorkerConfig {
  return {
    concurrency: env.WORKER_CONCURRENCY ?? 2,
    nodeEnv: env.NODE_ENV,
    redisUrl: env.REDIS_URL,
  };
}
