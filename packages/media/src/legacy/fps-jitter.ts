import type { PresetPart, Rng } from "../presets/index.js";

/**
 * Frame-rate jitter — микро-сдвиг fps для уникализации.
 * Мигрировано из run_make.ps1, строки 152-159.
 * Пул дельт из legacy: -0.03, -0.01, 0, 0.01, 0.03.
 */
export const FPS_JITTERS = [-0.03, -0.01, 0, 0.01, 0.03] as const;

/** Возвращает output-аргументы [-r jitteredFps] для подмены fps. */
export function fpsJitter(baseFps: number, rng: Rng = Math.random): PresetPart {
  const idx = Math.floor(rng() * FPS_JITTERS.length);
  const delta = FPS_JITTERS[idx] ?? 0;
  const target = Math.max(1, Number((baseFps + delta).toFixed(3)));
  return { output: ["-r", String(target)] };
}
