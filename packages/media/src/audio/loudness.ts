import { runFfmpeg } from "../ffmpeg/runner.js";

/** Целевые уровни громкости (LUFS) по платформам. */
export const LOUDNESS_TARGETS = {
  instagram: -14,
  tiktok: -14,
  reddit: -14,
  threads: -14,
  youtube: -16,
} as const;

const DEFAULT_TARGET = -14;
const LRA = 11;
const TP = -1.5;

/** Измеренные значения громкости из loudnorm (pass 1). */
export interface LoudnessMeasurement {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
}

interface LoudnessOptions {
  target?: number;
  ffmpegPath?: string;
}

function parseLoudnessJson(stderr: string): LoudnessMeasurement {
  const match = stderr.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("Не удалось извлечь JSON loudnorm из вывода ffmpeg");
  }
  return JSON.parse(match[0]) as LoudnessMeasurement;
}

/** Pass 1: измеряет громкость входа (loudnorm print_format=json). */
export async function measureLoudness(
  input: string,
  options: LoudnessOptions = {},
): Promise<LoudnessMeasurement> {
  const target = options.target ?? DEFAULT_TARGET;
  const result = await runFfmpeg(
    [
      "-i",
      input,
      "-af",
      `loudnorm=I=${target}:LRA=${LRA}:TP=${TP}:print_format=json`,
      "-f",
      "null",
      "-",
    ],
    options.ffmpegPath ? { ffmpegPath: options.ffmpegPath } : {},
  );
  return parseLoudnessJson(result.stderr);
}

/**
 * Двухпроходная нормализация громкости к target LUFS (linear=true).
 * Pass 1 — измерение, Pass 2 — применение измеренных значений.
 * Видео копируется (-c:v copy), аудио перекодируется.
 */
export async function normalizeLoudness(
  input: string,
  output: string,
  options: LoudnessOptions = {},
): Promise<void> {
  const target = options.target ?? DEFAULT_TARGET;
  const measured = await measureLoudness(input, options);

  const filter = [
    `loudnorm=I=${target}`,
    `LRA=${LRA}`,
    `TP=${TP}`,
    `measured_I=${measured.input_i}`,
    `measured_TP=${measured.input_tp}`,
    `measured_LRA=${measured.input_lra}`,
    `measured_thresh=${measured.input_thresh}`,
    `offset=${measured.target_offset}`,
    "linear=true",
    "print_format=summary",
  ].join(":");

  const result = await runFfmpeg(
    ["-i", input, "-af", filter, "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-y", output],
    options.ffmpegPath ? { ffmpegPath: options.ffmpegPath } : {},
  );
  if (result.code !== 0) {
    throw new Error(
      `loudnorm pass 2 завершился с кодом ${result.code}: ${result.stderr.slice(-300)}`,
    );
  }
}
