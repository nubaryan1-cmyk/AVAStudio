/**
 * Mock video-драйвер (Фаза 1, TASK 11.3). Имитирует async-природу text-to-video:
 * submit отдаёт job в состоянии "queued", последующие poll проходят queued →
 * processing → succeeded (через настраиваемое число опросов / задержку готовности).
 * Реализует VideoProvider (11.1). Реальные — ./runway.ts, ./luma.ts (Фаза 2).
 */
import { randomUUID } from "node:crypto";

import type {
  VideoJobHandle,
  VideoJobStatus,
  VideoProvider,
  VideoRequest,
} from "../../types.js";

export interface MockVideoOptions {
  name?: string;
  /** Сколько poll-ов до готовности (минимум 1; промежуточные → processing). */
  pollsUntilReady?: number;
  /** Принудительный сбой job. */
  fail?: boolean;
}

interface MockJob {
  req: VideoRequest;
  pollsLeft: number;
  startedAt: number;
}

/** Создаёт mock video-провайдер с имитацией асинхронной задачи. */
export function createMockVideoProvider(options: MockVideoOptions = {}): VideoProvider {
  const name = options.name ?? "mock-video";
  const pollsUntilReady = Math.max(1, options.pollsUntilReady ?? 1);
  const jobs = new Map<string, MockJob>();
  return {
    name,
    useCase: "video",
    async submitVideo(req: VideoRequest): Promise<VideoJobHandle> {
      if (options.fail === true) {
        throw new Error(`${name}: симулированный сбой submit`);
      }
      const jobId = randomUUID();
      jobs.set(jobId, { req, pollsLeft: pollsUntilReady, startedAt: Date.now() });
      return { jobId, provider: name, state: "queued" };
    },
    async pollVideo(jobId: string): Promise<VideoJobStatus> {
      const job = jobs.get(jobId);
      if (job === undefined) {
        return { jobId, state: "failed", error: "job not found" };
      }
      if (job.pollsLeft > 0) {
        job.pollsLeft -= 1;
      }
      if (job.pollsLeft > 0) {
        const total = pollsUntilReady;
        return { jobId, state: "processing", progress: (total - job.pollsLeft) / total };
      }
      const durationSec = job.req.durationSec ?? 5;
      return {
        jobId,
        state: "succeeded",
        progress: 1,
        video: { kind: "video", url: `mock://video/${name}/${jobId}.mp4`, mimeType: "video/mp4", durationSec },
        meta: { provider: name, model: `${name}-v1`, useCase: "video", latencyMs: Date.now() - job.startedAt },
      };
    },
  };
}
