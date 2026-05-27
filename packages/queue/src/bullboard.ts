import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { Queue } from "bullmq";
import express, { type Express, type RequestHandler } from "express";

import { getRedisConnection } from "./connection.js";
import { MAINTENANCE_QUEUE } from "./cron.js";
import { deadLetterQueueName } from "./dlq.js";
import { QUEUE_NAMES } from "./queues/index.js";
import { getQueue } from "./queues/registry.js";

/**
 * ЗАГЛУШКА admin-guard. В Фазе 2 (ЭТАП 10) заменяется на реальный admin-auth (RBAC).
 * Если adminToken задан — требует заголовок x-admin-token; иначе пропускает (локалка).
 */
export function makeAdminGuard(adminToken?: string): RequestHandler {
  return (req, res, next) => {
    if (adminToken && req.headers["x-admin-token"] !== adminToken) {
      res.status(401).send("Unauthorized");
      return;
    }
    next();
  };
}

/** Express-приложение с BullBoard на /admin/queues (все очереди + DLQ + maintenance). */
export function createBoardApp(options: { adminToken?: string } = {}): Express {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");

  const connection = getRedisConnection();
  const main = QUEUE_NAMES.map((name) => new BullMQAdapter(getQueue(name)));
  const dlqs = QUEUE_NAMES.map(
    (name) => new BullMQAdapter(new Queue(deadLetterQueueName(name), { connection })),
  );
  const maintenance = new BullMQAdapter(new Queue(MAINTENANCE_QUEUE, { connection }));

  createBullBoard({ queues: [...main, ...dlqs, maintenance], serverAdapter });

  const app = express();
  app.use("/admin/queues", makeAdminGuard(options.adminToken), serverAdapter.getRouter());
  return app;
}
