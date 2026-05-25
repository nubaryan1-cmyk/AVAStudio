import { validationErrorFromZod } from "@avastudio/shared";
import { Queue, type JobsOptions } from "bullmq";

import { getRedisConnection } from "../connection.js";

import { DEFAULT_JOB_OPTIONS, jobSchemas, type JobData, type QueueName } from "./definitions.js";

const queues = new Map<QueueName, Queue>();

/** Лениво создаёт/возвращает BullMQ-очередь по имени (с дефолтными опциями). */
export function getQueue(name: QueueName): Queue {
  let queue = queues.get(name);
  if (!queue) {
    queue = new Queue(name, {
      connection: getRedisConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    queues.set(name, queue);
  }
  return queue;
}

/** Валидирует данные job'а Zod-схемой очереди. Бросает ValidationError при ошибке. */
export function validateJobData<Q extends QueueName>(name: Q, data: unknown): JobData<Q> {
  const result = jobSchemas[name].safeParse(data);
  if (!result.success) {
    throw validationErrorFromZod(result.error);
  }
  return result.data as JobData<Q>;
}

/** Типобезопасно добавляет job в очередь (валидирует данные перед добавлением). */
export async function enqueue<Q extends QueueName>(
  name: Q,
  data: JobData<Q>,
  options?: JobsOptions,
) {
  const validated = validateJobData(name, data);
  return getQueue(name).add(name, validated, options);
}

/** Закрывает все созданные очереди (graceful shutdown). */
export async function closeAllQueues(): Promise<void> {
  await Promise.all([...queues.values()].map((q) => q.close()));
  queues.clear();
}
