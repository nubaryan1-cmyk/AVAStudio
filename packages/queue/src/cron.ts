import { Queue } from "bullmq";

import { getRedisConnection } from "./connection.js";

/** Очередь для повторяющихся обслуживающих задач. */
export const MAINTENANCE_QUEUE = "maintenance";

export interface CronSchedule {
  id: string;
  pattern: string;
  description: string;
}

/** Расписания cron (BullMQ Job Schedulers). */
export const CRON_SCHEDULES: readonly CronSchedule[] = [
  {
    id: "cleanup-expired-sessions",
    pattern: "0 */6 * * *",
    description: "Очистка истёкших сессий каждые 6 часов",
  },
  {
    id: "aggregate-usage",
    pattern: "0 3 * * *",
    description: "Ежедневная агрегация usage в 03:00",
  },
  {
    id: "db-backup-local",
    pattern: "30 3 * * *",
    description: "Ежедневный локальный бэкап БД в 03:30 (заглушка до Фазы 2)",
  },
] as const;

let maintenanceQueue: Queue | null = null;

export function getMaintenanceQueue(): Queue {
  if (!maintenanceQueue) {
    maintenanceQueue = new Queue(MAINTENANCE_QUEUE, { connection: getRedisConnection() });
  }
  return maintenanceQueue;
}

/** Регистрирует/обновляет все cron-расписания (idempotent через upsert по id). */
export async function registerCronJobs(): Promise<void> {
  const queue = getMaintenanceQueue();
  for (const schedule of CRON_SCHEDULES) {
    await queue.upsertJobScheduler(
      schedule.id,
      { pattern: schedule.pattern },
      { name: schedule.id, data: {} },
    );
  }
}

/** Текущие зарегистрированные расписания (из Redis). */
export async function listScheduledJobs() {
  return getMaintenanceQueue().getJobSchedulers();
}
