import { NotFoundError } from "@avastudio/shared";
import { Queue, type Worker } from "bullmq";

import { getRedisConnection } from "./connection.js";
import { DEFAULT_JOB_OPTIONS, getQueue, type QueueName } from "./queues/index.js";

/** Имя dead-letter-очереди для исходной. */
export function deadLetterQueueName(name: QueueName): string {
  return `${name}-dlq`;
}

/** Запись в DLQ: оригинальные данные + причина + стектрейс + время. */
export interface DeadLetterRecord {
  originalQueue: string;
  originalJobId: string | undefined;
  name: string;
  data: unknown;
  attemptsMade: number;
  failedReason: string;
  stacktrace: string[];
  failedAt: string;
}

/** Минимальная форма упавшего job'а (BullMQ Job ей удовлетворяет; удобно для тестов). */
export interface FailedJobLike {
  id?: string | undefined;
  name: string;
  data: unknown;
  attemptsMade: number;
  stacktrace?: string[] | null | undefined;
  opts?: { attempts?: number | undefined } | undefined;
}

export function buildDeadLetterRecord(
  queueName: string,
  job: FailedJobLike,
  error: Error,
): DeadLetterRecord {
  return {
    originalQueue: queueName,
    originalJobId: job.id,
    name: job.name,
    data: job.data,
    attemptsMade: job.attemptsMade,
    failedReason: error.message,
    stacktrace: job.stacktrace ?? (error.stack ? [error.stack] : []),
    failedAt: new Date().toISOString(),
  };
}

/** Извлекает из DLQ-записи данные для повторной постановки в исходную очередь. */
export function buildReplayJob(record: DeadLetterRecord): { name: string; data: unknown } {
  return { name: record.name, data: record.data };
}

const DEFAULT_MAX_ATTEMPTS = DEFAULT_JOB_OPTIONS.attempts ?? 3;

/**
 * Обрабатывает упавший job: если исчерпаны попытки — отправляет запись в sink (DLQ).
 * sink абстрагирован, чтобы логику можно было тестировать без Redis.
 */
export async function handleFailedJob(
  queueName: string,
  job: FailedJobLike,
  error: Error,
  sink: (record: DeadLetterRecord) => Promise<void>,
  maxAttempts: number = DEFAULT_MAX_ATTEMPTS,
): Promise<void> {
  const attempts = job.opts?.attempts ?? maxAttempts;
  if (job.attemptsMade >= attempts) {
    await sink(buildDeadLetterRecord(queueName, job, error));
  }
}

// ── Redis-зависимая часть (DLQ-очереди, list/replay/purge) ──

const dlqQueues = new Map<string, Queue>();

function getDlqQueue(queueName: QueueName): Queue {
  const name = deadLetterQueueName(queueName);
  let queue = dlqQueues.get(name);
  if (!queue) {
    queue = new Queue(name, { connection: getRedisConnection() });
    dlqQueues.set(name, queue);
  }
  return queue;
}

/** Подключает обработчик: упавший (после ретраев) job → в DLQ, не теряется. */
export function registerDeadLetterHandler(worker: Worker, queueName: QueueName): void {
  worker.on("failed", (job, error) => {
    if (!job) return;
    void handleFailedJob(queueName, job, error, async (record) => {
      await getDlqQueue(queueName).add("dead-letter", record, { removeOnComplete: false });
    });
  });
}

/** Список записей DLQ. */
export async function listDLQ(queueName: QueueName, limit = 100): Promise<DeadLetterRecord[]> {
  const jobs = await getDlqQueue(queueName).getJobs(
    ["waiting", "delayed", "completed", "failed"],
    0,
    limit,
  );
  return jobs.map((j) => j.data as DeadLetterRecord);
}

/** Возвращает один job из DLQ в исходную очередь и удаляет из DLQ. */
export async function replayJob(queueName: QueueName, dlqJobId: string): Promise<void> {
  const dlq = getDlqQueue(queueName);
  const job = await dlq.getJob(dlqJobId);
  if (!job) {
    throw new NotFoundError({
      userMessage: "Запись DLQ не найдена",
      internalMessage: `dlq job ${dlqJobId}`,
    });
  }
  const replay = buildReplayJob(job.data as DeadLetterRecord);
  await getQueue(queueName).add(replay.name, replay.data);
  await job.remove();
}

/** Возвращает все записи DLQ в исходную очередь. */
export async function replayAll(queueName: QueueName): Promise<number> {
  const dlq = getDlqQueue(queueName);
  const jobs = await dlq.getJobs(["waiting", "delayed", "completed", "failed"]);
  for (const job of jobs) {
    const replay = buildReplayJob(job.data as DeadLetterRecord);
    await getQueue(queueName).add(replay.name, replay.data);
    await job.remove();
  }
  return jobs.length;
}

/** Полностью очищает DLQ. */
export async function purgeDLQ(queueName: QueueName): Promise<void> {
  await getDlqQueue(queueName).obliterate({ force: true });
  dlqQueues.delete(deadLetterQueueName(queueName));
}
