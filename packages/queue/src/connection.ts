import { env } from "@avastudio/shared";
import { Redis } from "ioredis";

let connection: Redis | null = null;

/**
 * Singleton ioredis-подключение для BullMQ.
 * maxRetriesPerRequest: null — обязательное требование BullMQ для блокирующих команд.
 */
export function getRedisConnection(): Redis {
  if (!connection) {
    connection = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }
  return connection;
}

/** Graceful close соединения (вызывать при остановке процесса). */
export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
