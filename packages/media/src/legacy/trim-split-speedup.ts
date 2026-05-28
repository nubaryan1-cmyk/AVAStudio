/**
 * Trim-split + speed-up конвейер (мигрировано из legacy FULL_AUTO.js, строки 66-71).
 * Разделяет видео на 2 сегмента: первый в нормальной скорости, второй ускорен в N раз.
 * Возвращает filter_complex (cтрока) + аудио-фильтр + сборка concat.
 *
 * Магические числа из legacy:
 *   TOTAL_DURATION = 5.0  — общая длина окна
 *   SPEED_FACTOR   = 3.0  — ускорение второго сегмента
 */
export const LEGACY_TOTAL_DURATION_SEC = 5.0;
export const LEGACY_SPEED_FACTOR = 3.0;

export interface TrimSplitSpeedupOptions {
  startSec?: number;
  splitPointSec: number;
  totalDurationSec?: number;
  speedFactor?: number;
}

/** Строит filter_complex как в FULL_AUTO.js. Возвращает готовую строку для `-filter_complex`. */
export function buildTrimSplitSpeedupFilter(options: TrimSplitSpeedupOptions): string {
  const start = options.startSec ?? 0;
  const total = options.totalDurationSec ?? LEGACY_TOTAL_DURATION_SEC;
  const split = options.splitPointSec;
  const factor = options.speedFactor ?? LEGACY_SPEED_FACTOR;
  const end = start + total;
  const setptsFactor = (1 / factor).toFixed(2);
  return (
    `[0:v]trim=${start}:${split},setpts=PTS-STARTPTS[v1];` +
    `[0:v]trim=${split}:${end},setpts=${setptsFactor}*(PTS-STARTPTS)[v2];` +
    `[0:a]atrim=${start}:${split},asetpts=PTS-STARTPTS[a1];` +
    `[0:a]atrim=${split}:${end},atempo=${factor.toFixed(1)},asetpts=PTS-STARTPTS[a2];` +
    `[v1][a1][v2][a2]concat=n=2:v=1:a=1[outv][outa]`
  );
}
