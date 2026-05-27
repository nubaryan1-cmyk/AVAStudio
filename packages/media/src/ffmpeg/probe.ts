import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { ValidationError, validationErrorFromZod } from "@avastudio/shared";
import { z } from "zod";

const execFileAsync = promisify(execFile);

// Лимиты входящих медиа.
const MAX_DURATION_SEC = 600; // 10 минут
const MAX_WIDTH = 3840; // 4K
const MAX_HEIGHT = 2160;
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 МБ
const MAX_STREAMS = 20; // защита от файла с тысячами потоков

export interface ProbeData {
  durationSec: number;
  sizeBytes: number;
  bitrate: number | null;
  streamCount: number;
  video: { codec: string; width: number; height: number; fps: number } | null;
  audio: { codec: string; channels: number } | null;
}

interface RawStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  channels?: number;
}
interface RawProbe {
  streams?: RawStream[];
  format?: { duration?: string; size?: string; bit_rate?: string };
}

function parseFps(value: string | undefined): number {
  if (!value) return 0;
  const parts = value.split("/").map(Number);
  const n = parts[0] ?? 0;
  const d = parts[1];
  if (d === undefined || d === 0) return n;
  return n / d;
}

/** Анализирует медиафайл через ffprobe. Бросает ValidationError на нечитаемом/не-медиа файле. */
export async function probe(
  filePath: string,
  options: { ffprobePath?: string } = {},
): Promise<ProbeData> {
  const binary = options.ffprobePath ?? "ffprobe";
  let stdout: string;
  try {
    const result = await execFileAsync(
      binary,
      ["-v", "error", "-show_format", "-show_streams", "-of", "json", filePath],
      { maxBuffer: 10 * 1024 * 1024 },
    );
    stdout = result.stdout;
  } catch (error) {
    throw new ValidationError({
      userMessage: "Не удалось прочитать медиафайл",
      internalMessage: error instanceof Error ? error.message : String(error),
    });
  }

  let raw: RawProbe;
  try {
    raw = JSON.parse(stdout) as RawProbe;
  } catch {
    throw new ValidationError({ userMessage: "Файл не является корректным медиа" });
  }

  const streams = raw.streams ?? [];
  const v = streams.find((s) => s.codec_type === "video");
  const a = streams.find((s) => s.codec_type === "audio");

  return {
    durationSec: Number(raw.format?.duration ?? 0),
    sizeBytes: Number(raw.format?.size ?? 0),
    bitrate: raw.format?.bit_rate ? Number(raw.format.bit_rate) : null,
    streamCount: streams.length,
    video: v
      ? {
          codec: v.codec_name ?? "",
          width: v.width ?? 0,
          height: v.height ?? 0,
          fps: parseFps(v.r_frame_rate),
        }
      : null,
    audio: a ? { codec: a.codec_name ?? "", channels: a.channels ?? 0 } : null,
  };
}

const probeDataSchema = z.object({
  durationSec: z.number().max(MAX_DURATION_SEC, "Длительность превышает 10 минут"),
  sizeBytes: z.number().max(MAX_SIZE_BYTES, "Файл больше 500 МБ"),
  streamCount: z.number().max(MAX_STREAMS, "Слишком много потоков в файле"),
  bitrate: z.number().nullable(),
  video: z.object(
    {
      codec: z.string(),
      width: z.number().max(MAX_WIDTH, "Ширина превышает 4K"),
      height: z.number().max(MAX_HEIGHT, "Высота превышает 4K"),
      fps: z.number(),
    },
    {
      invalid_type_error: "Файл не содержит видеопоток",
      required_error: "Файл не содержит видеопоток",
    },
  ),
  audio: z.object({ codec: z.string(), channels: z.number() }).nullable(),
});

/** Проверяет метаданные против лимитов. Бросает ValidationError при нарушении/отсутствии видео. */
export function validateProbeData(data: ProbeData): ProbeData {
  const result = probeDataSchema.safeParse(data);
  if (!result.success) {
    throw validationErrorFromZod(result.error);
  }
  return data;
}

/** Анализ + валидация одним вызовом. */
export async function probeAndValidate(
  filePath: string,
  options?: { ffprobePath?: string },
): Promise<ProbeData> {
  return validateProbeData(await probe(filePath, options));
}

export const PROBE_LIMITS = {
  MAX_DURATION_SEC,
  MAX_WIDTH,
  MAX_HEIGHT,
  MAX_SIZE_BYTES,
  MAX_STREAMS,
} as const;
