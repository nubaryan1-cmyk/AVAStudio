import { runFfmpeg } from "../ffmpeg/runner.js";

interface CommonOptions {
  ffmpegPath?: string;
}

export interface ThumbnailOptions extends CommonOptions {
  /** Секунда, с которой берётся кадр (по умолчанию 2). */
  atSec?: number;
  /** Качество JPEG (mjpeg -q:v, 2 — лучшее .. 31 — худшее; по умолчанию 3 ≈ высокое). */
  qv?: number;
  /** Опциональный ресайз по ширине (высота авто). */
  width?: number;
}

export interface PreviewGifOptions extends CommonOptions {
  durationSec?: number;
  fps?: number;
  width?: number;
}

/** Кадр-превью (JPEG) с заданной секунды. Возвращает путь к файлу. */
export async function generateThumbnail(
  input: string,
  output: string,
  options: ThumbnailOptions = {},
): Promise<string> {
  const atSec = options.atSec ?? 2;
  const qv = options.qv ?? 3;
  const args = ["-ss", String(atSec), "-i", input, "-frames:v", "1", "-q:v", String(qv)];
  if (options.width) {
    args.push("-vf", `scale=${options.width}:-1`);
  }
  args.push("-y", output);
  const result = await runFfmpeg(
    args,
    options.ffmpegPath ? { ffmpegPath: options.ffmpegPath } : {},
  );
  if (result.code !== 0) {
    throw new Error(`generateThumbnail: ffmpeg код ${result.code}: ${result.stderr.slice(-200)}`);
  }
  return output;
}

/** Анимированный GIF-превью (по умолчанию 3с, 10fps, ширина 480). Возвращает путь. */
export async function generatePreviewGif(
  input: string,
  output: string,
  options: PreviewGifOptions = {},
): Promise<string> {
  const durationSec = options.durationSec ?? 3;
  const fps = options.fps ?? 10;
  const width = options.width ?? 480;
  const args = [
    "-t",
    String(durationSec),
    "-i",
    input,
    "-vf",
    `fps=${fps},scale=${width}:-1:flags=lanczos`,
    "-loop",
    "0",
    "-y",
    output,
  ];
  const result = await runFfmpeg(
    args,
    options.ffmpegPath ? { ffmpegPath: options.ffmpegPath } : {},
  );
  if (result.code !== 0) {
    throw new Error(`generatePreviewGif: ffmpeg код ${result.code}: ${result.stderr.slice(-200)}`);
  }
  return output;
}
