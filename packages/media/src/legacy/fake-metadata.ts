import type { PresetPart, Rng } from "../presets/index.js";

/**
 * Fake device metadata: стрипает оригинальные метаданные и подставляет фейковые
 * device_manufacturer / device_model / software / creation_time / location.
 * Мигрировано из run_make.ps1, строки 71-81 (пулы) и 162-180 (применение).
 * НЕ дублирует preset `metadataStrip` (6.3) — здесь дополнительно ВНЕДРЯЕТ фейк.
 */
export const LEGACY_DEVICE_MODELS = [
  "iPhone 12",
  "iPhone 12 Pro",
  "iPhone 13",
  "iPhone 13 Pro",
  "iPhone 14",
  "iPhone 14 Plus",
  "iPhone 14 Pro",
  "iPhone 15",
  "iPhone 15 Pro",
  "iPhone 15 Pro Max",
  "Samsung Galaxy S23",
  "Samsung Galaxy S24",
  "Google Pixel 7",
  "Google Pixel 8",
  "OnePlus 12",
] as const;

export const LEGACY_MANUFACTURERS = [
  "Apple",
  "Apple",
  "Apple",
  "Apple",
  "Samsung",
  "Samsung",
  "Google",
  "OnePlus",
] as const;
export const LEGACY_SOFTWARE_VERSIONS = [
  "17.1",
  "17.2",
  "17.3",
  "17.4",
  "17.5",
  "16.7",
  "15.8",
  "14.8",
] as const;
export const LEGACY_TIMEZONES = [
  "UTC+3",
  "UTC+0",
  "UTC+1",
  "UTC+2",
  "UTC-5",
  "UTC+8",
  "UTC+9",
  "UTC-3",
  "UTC+5:30",
] as const;

function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)] as T;
}

export function fakeDeviceMetadata(rng: Rng = Math.random, now: Date = new Date()): PresetPart {
  const devIdx = Math.floor(rng() * LEGACY_DEVICE_MODELS.length);
  const device = LEGACY_DEVICE_MODELS[devIdx]!;
  const mfg = LEGACY_MANUFACTURERS[Math.min(devIdx, LEGACY_MANUFACTURERS.length - 1)]!;
  const software = pick(LEGACY_SOFTWARE_VERSIONS, rng);
  const tz = pick(LEGACY_TIMEZONES, rng);
  const daysAgo = Math.floor(rng() * 180) + 1;
  const fakeDate = new Date(now.getTime() - daysAgo * 86400_000).toISOString().slice(0, 19);
  return {
    output: [
      "-map_metadata",
      "-1",
      "-movflags",
      "+use_metadata_tags",
      "-metadata",
      `device_manufacturer=${mfg}`,
      "-metadata",
      `device_model=${device}`,
      "-metadata",
      `software=iOS ${software}`,
      "-metadata",
      `creation_time=${fakeDate}`,
      "-metadata",
      `location=${tz}`,
    ],
  };
}
