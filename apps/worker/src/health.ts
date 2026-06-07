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
  /** Провайдер текста метрик Prometheus для /metrics (TASK 8.4). */
  metricsText?: () => Promise<string> | string;
}

/** Стартует Hono-сервер с /health и /metrics (Prometheus). */
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

  // Метрики очередей в формате Prometheus (TASK 8.4). Если провайдер не задан —
  // отдаём пустой комментарий (валидный для Prometheus scrape).
  app.get("/metrics", async (c) => {
    if (!options.metricsText) return c.text("# no metrics provider\n");
    try {
      const body = await options.metricsText();
      return c.text(body);
    } catch (error) {
      options.logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        "не удалось собрать метрики",
      );
      return c.text("# metrics collection failed\n", 500);
    }
  });

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
