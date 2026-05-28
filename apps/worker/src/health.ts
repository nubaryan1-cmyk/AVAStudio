import { serve } from "@hono/node-server";
import { Hono } from "hono";

import type { Logger } from "@avastudio/shared";

/** Минимальный интерфейс Redis для health-check (совместим и с ioredis, и с fake в тестах). */
export interface HealthRedis {
  ping(): Promise<string>;
}

export interface HealthServer {
  port: number;
  close: () => Promise<void>;
}

export interface HealthServerOptions {
  port: number;
  redis: HealthRedis;
  logger: Logger;
  pingTimeoutMs?: number;
}

/** Стартует Hono-сервер с /health и /metrics (заглушка). */
export function startHealthServer(options: HealthServerOptions): Promise<HealthServer> {
  const app = new Hono();

  app.get("/health", async (c) => {
    try {
      const timeoutMs = options.pingTimeoutMs ?? 2000;
      const pong = await Promise.race([
        options.redis.ping(),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("redis ping timeout")), timeoutMs),
        ),
      ]);
      if (pong === "PONG") return c.json({ status: "ok" });
      return c.json({ status: "degraded", redis: pong }, 503);
    } catch (error) {
      return c.json(
        { status: "down", error: error instanceof Error ? error.message : String(error) },
        503,
      );
    }
  });

  // Заглушка под Prometheus — реальные метрики в ЭТАП 8.4 / 24.5.
  app.get("/metrics", (c) => c.text("# worker metrics placeholder\n"));

  return new Promise<HealthServer>((resolve) => {
    const server = serve({ fetch: app.fetch, port: options.port }, (info) => {
      options.logger.info({ port: info.port }, "health-сервер запущен");
      resolve({
        port: info.port,
        close: () =>
          new Promise<void>((res) => {
            server.close(() => res());
          }),
      });
    });
  });
}
