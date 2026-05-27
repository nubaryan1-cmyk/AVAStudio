import { spawn } from "node:child_process";

import { env } from "@avastudio/shared";

/** Путь к ffmpeg: env.FFMPEG_PATH или системный "ffmpeg" (вызывается воркером с env). */
export function resolveFfmpegPath(): string {
  return env.FFMPEG_PATH ?? "ffmpeg";
}

/** Путь к ffprobe: env.FFPROBE_PATH или системный "ffprobe". */
export function resolveFfprobePath(): string {
  return env.FFPROBE_PATH ?? "ffprobe";
}

export interface FfmpegProgress {
  /** Текущая позиция обработки в миллисекундах. */
  timeMs: number;
}

export interface RunFfmpegOptions {
  onProgress?: (progress: FfmpegProgress) => void;
  /** Переопределение пути к бинарю (по умолчанию "ffmpeg"). */
  ffmpegPath?: string;
  signal?: AbortSignal;
}

export interface FfmpegResult {
  code: number;
  stderr: string;
}

const TIME_RE = /time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/;

/** Парсит позицию из строки прогресса ffmpeg (time=HH:MM:SS.cc) в мс; null если нет. */
export function parseProgressTimeMs(line: string): number | null {
  const match = TIME_RE.exec(line);
  if (!match) {
    return null;
  }
  const [, hh, mm, ss, cs] = match;
  return (Number(hh) * 3600 + Number(mm) * 60 + Number(ss)) * 1000 + Number(cs) * 10;
}

/**
 * Запускает ffmpeg через spawn с МАССИВОМ аргументов (без shell — нет инъекций).
 * Собирает stderr, парсит прогресс, возвращает exit code.
 */
export function runFfmpeg(
  args: readonly string[],
  options: RunFfmpegOptions = {},
): Promise<FfmpegResult> {
  return new Promise((resolve, reject) => {
    const binary = options.ffmpegPath ?? "ffmpeg";
    const child = spawn(binary, [...args], options.signal ? { signal: options.signal } : {});
    let stderr = "";

    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      if (options.onProgress) {
        for (const line of text.split(/[\r\n]/)) {
          const timeMs = parseProgressTimeMs(line);
          if (timeMs !== null) {
            options.onProgress({ timeMs });
          }
        }
      }
    });

    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? -1, stderr }));
  });
}
