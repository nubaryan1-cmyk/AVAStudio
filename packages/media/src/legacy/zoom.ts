import type { PresetPart, Rng } from "../presets/index.js";

/**
 * Zoom без чёрных полей: scale-up на 1-5% затем crop назад до исходного размера.
 * Мигрировано из run_make.ps1, строки 120-127. Отличается от preset `crop` (6.3) —
 * сохраняет исходный размер и не уменьшает картинку.
 */
const ZOOM_MIN_PCT = 0.01;
const ZOOM_MAX_PCT = 0.05;

export const zoomNoBorders = (rng: Rng = Math.random): PresetPart => {
  const factor = 1 + (ZOOM_MIN_PCT + rng() * (ZOOM_MAX_PCT - ZOOM_MIN_PCT));
  const f = factor.toFixed(4);
  return {
    video: [`scale=iw*${f}:ih*${f}:flags=lanczos`, `crop=iw/${f}:ih/${f}`],
  };
};
