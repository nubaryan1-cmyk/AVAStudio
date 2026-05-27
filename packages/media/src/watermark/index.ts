import { runFfmpeg } from "../ffmpeg/runner.js";

export type WatermarkPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface WatermarkConfig {
  logoPath: string;
  position: WatermarkPosition;
  opacity: number;
  margin: number;
}

export interface ApplyWatermarkOptions {
  position?: WatermarkPosition;
  opacity?: number;
  margin?: number;
  ffmpegPath?: string;
}

function overlayExpr(position: WatermarkPosition, margin: number): string {
  switch (position) {
    case "top-left":
      return `${margin}:${margin}`;
    case "top-right":
      return `main_w-overlay_w-${margin}:${margin}`;
    case "bottom-left":
      return `${margin}:main_h-overlay_h-${margin}`;
    case "bottom-right":
      return `main_w-overlay_w-${margin}:main_h-overlay_h-${margin}`;
  }
}

/** Накладывает логотип (overlay) с заданной позицией и прозрачностью. */
export async function applyWatermark(
  input: string,
  output: string,
  logoPath: string,
  options: ApplyWatermarkOptions = {},
): Promise<string> {
  const position = options.position ?? "bottom-right";
  const opacity = options.opacity ?? 0.4;
  const margin = options.margin ?? 10;
  const filterComplex =
    `[1:v]format=rgba,colorchannelmixer=aa=${opacity}[wm];` +
    `[0:v][wm]overlay=${overlayExpr(position, margin)}[outv]`;
  const result = await runFfmpeg(
    [
      "-i",
      input,
      "-i",
      logoPath,
      "-filter_complex",
      filterComplex,
      "-map",
      "[outv]",
      "-map",
      "0:a?",
      "-c:a",
      "copy",
      "-c:v",
      "mpeg4",
      "-y",
      output,
    ],
    options.ffmpegPath ? { ffmpegPath: options.ffmpegPath } : {},
  );
  if (result.code !== 0) {
    throw new Error(`applyWatermark: ffmpeg код ${result.code}: ${result.stderr.slice(-200)}`);
  }
  return output;
}

export type Tier = "free" | "paid" | "b2b";

export interface ResolveWatermarkOptions {
  /** Логотип по умолчанию ("made with AVAStudio") — для free. */
  defaultLogoPath?: string;
  /** Кастомный логотип — для b2b. */
  customLogoPath?: string;
  /** Запрошен ли watermark платным юзером (paid — опционально). */
  enabledForPaid?: boolean;
  position?: WatermarkPosition;
  opacity?: number;
  margin?: number;
}

/**
 * Логика watermark по тарифу (заглушка — реальные entitlements в ЭТАПЕ 9):
 * free → обязательный дефолтный логотип; paid → опционально; b2b → кастомный логотип.
 * Возвращает конфиг или null (без watermark).
 */
export function resolveWatermark(
  tier: Tier,
  options: ResolveWatermarkOptions = {},
): WatermarkConfig | null {
  const base = {
    position: options.position ?? "bottom-right",
    opacity: options.opacity ?? 0.4,
    margin: options.margin ?? 10,
  } as const;

  switch (tier) {
    case "free":
      if (!options.defaultLogoPath) {
        throw new Error("free-тариф требует defaultLogoPath");
      }
      return { logoPath: options.defaultLogoPath, ...base };
    case "paid":
      if (options.enabledForPaid && options.defaultLogoPath) {
        return { logoPath: options.defaultLogoPath, ...base };
      }
      return null;
    case "b2b":
      return options.customLogoPath ? { logoPath: options.customLogoPath, ...base } : null;
  }
}
