import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runFfmpeg, type FfmpegProgress } from "../ffmpeg/runner.js";

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/** Создаёт временную папку и гарантированно удаляет её после fn (даже при ошибке). */
export async function withTempDir<T>(jobId: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), `avastudio-${jobId}-`));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export interface SandboxResult {
  code: number;
  stderr: string;
  timedOut: boolean;
}

export interface SandboxOptions {
  timeoutMs?: number;
  ffmpegPath?: string;
  onProgress?: (p: FfmpegProgress) => void;
}

/** Запускает FFmpeg с таймаутом: по истечении процесс убивается (code 143, timedOut). */
export async function runFfmpegSandboxed(
  args: readonly string[],
  options: SandboxOptions = {},
): Promise<SandboxResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await runFfmpeg(args, {
      signal: controller.signal,
      ...(options.ffmpegPath ? { ffmpegPath: options.ffmpegPath } : {}),
      ...(options.onProgress ? { onProgress: options.onProgress } : {}),
    });
    return { ...res, timedOut: false };
  } catch (error) {
    if (controller.signal.aborted) {
      return { code: 143, stderr: "FFmpeg убит по таймауту", timedOut: true };
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/** Ограничитель параллелизма (защита от перегрузки CPU/памяти). */
export function createConcurrencyLimiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    while (active >= max) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active += 1;
    try {
      return await fn();
    } finally {
      active -= 1;
      queue.shift()?.();
    }
  };
}
