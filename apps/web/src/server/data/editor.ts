import {
  buildUniqueArgs,
  composePresets,
  mulberry32,
  PRESETS,
  PROFILES,
  type PresetPart,
  type ProfileId,
} from "@avastudio/media";

import { PRESET_LABELS, PROFILE_LABELS, type RenderStatus } from "../../lib/editor.js";

import { addAsset, getAsset } from "./media.js";

/**
 * Оркестрация редактора-уникализатора (Фаза 1).
 * Реальные пресеты/профили из @avastudio/media (ЭТАП 6.3/6.4) собирают ffmpeg-аргументы.
 * Полный рендер уходит в очередь render-video (worker). Здесь — детерминированный
 * мок воркера (по времени) для локального превью прогресса; результат → в медиатеку.
 */

const PRESET_IDS = Object.keys(PRESETS);
const PROFILE_IDS = Object.keys(PROFILES) as ProfileId[];
/** Длительность мок-рендера одного варианта — заведомо <60с (критерий приёмки). */
const RENDER_MS = 4000;

export interface PresetOption {
  id: string;
  label: string;
}
export interface ProfileOption {
  id: ProfileId;
  label: string;
  width: number;
  height: number;
  maxDurationSec: number;
}

export function listPresets(): PresetOption[] {
  return PRESET_IDS.map((id) => ({ id, label: PRESET_LABELS[id] ?? id }));
}

export function listProfiles(): ProfileOption[] {
  return PROFILE_IDS.map((id) => {
    const p = PROFILES[id];
    return { id, label: PROFILE_LABELS[id], width: p.width, height: p.height, maxDurationSec: p.maxDurationSec };
  });
}

export interface PreviewInput {
  sourceAssetId: string;
  presetIds: string[];
  seed?: number | undefined;
}

export interface PreviewResult {
  videoFilter: string;
  audioFilter: string;
  outputArgs: string[];
  /** Готовая команда ffmpeg (массив аргументов, без shell). */
  args: string[];
}

function compose(presetIds: string[], seed: number): PresetPart[] {
  const rng = mulberry32(seed);
  const valid = presetIds.filter((id) => id in PRESETS);
  return valid.map((id) => PRESETS[id]!(rng));
}

/** Быстрое превью: собирает фильтры/команду без запуска рендера. */
export function buildPreview(input: PreviewInput): PreviewResult {
  const asset = getAsset(input.sourceAssetId);
  if (!asset) throw new Error("Исходное видео не найдено");
  if (asset.type !== "video") throw new Error("Уникализация доступна только для видео");
  const composed = composePresets(compose(input.presetIds, input.seed ?? 1));
  const args = buildUniqueArgs(asset.storagePath, "preview_lowres.mp4", composed);
  return { videoFilter: composed.videoFilter, audioFilter: composed.audioFilter, outputArgs: composed.outputArgs, args };
}

export interface EnqueueInput {
  sourceAssetId: string;
  presetIds: string[];
  profileIds: ProfileId[];
  variants: number;
  seed?: number | undefined;
}

interface RenderJob {
  id: string;
  batchId: string;
  variant: number;
  profileId: ProfileId;
  presetIds: string[];
  seed: number;
  sourceAssetId: string;
  resultName: string;
  durationSec: number;
  width: number;
  height: number;
  startedAt: number;
  resultAssetId: string | null;
}

export interface RenderJobView {
  id: string;
  batchId: string;
  variant: number;
  profileId: ProfileId;
  progress: number;
  status: RenderStatus;
  resultAssetId: string | null;
  resultName: string;
}

let seq = 0;
const JOBS = new Map<string, RenderJob>();

export function enqueueRender(input: EnqueueInput): { batchId: string; jobs: RenderJobView[] } {
  const asset = getAsset(input.sourceAssetId);
  if (!asset) throw new Error("Исходное видео не найдено");
  if (asset.type !== "video") throw new Error("Уникализация доступна только для видео");
  if (input.profileIds.length === 0) throw new Error("Выберите хотя бы одну платформу");

  const baseSeed = input.seed ?? Date.now();
  const batchId = `batch_${(seq += 1)}`;
  const base = asset.name.replace(/\.[^.]+$/, "");
  const now = Date.now();
  const created: RenderJob[] = [];

  for (let v = 1; v <= input.variants; v += 1) {
    for (const profileId of input.profileIds) {
      const profile = PROFILES[profileId];
      const id = `job_${(seq += 1)}`;
      const durationSec = Math.min(asset.durationSec ?? profile.maxDurationSec, profile.maxDurationSec);
      const job: RenderJob = {
        id,
        batchId,
        variant: v,
        profileId,
        presetIds: input.presetIds,
        seed: baseSeed + v,
        sourceAssetId: input.sourceAssetId,
        resultName: `${base}-v${v}-${profileId}.mp4`,
        durationSec,
        width: profile.width,
        height: profile.height,
        startedAt: now,
        resultAssetId: null,
      };
      JOBS.set(id, job);
      created.push(job);
    }
  }
  return { batchId, jobs: created.map(viewOf) };
}

function viewOf(job: RenderJob): RenderJobView {
  const elapsed = Date.now() - job.startedAt;
  const progress = Math.max(0, Math.min(100, Math.floor((elapsed / RENDER_MS) * 100)));
  let status: RenderStatus;
  if (progress >= 100) status = "completed";
  else if (progress < 5) status = "queued";
  else status = "active";

  // Материализация результата в медиатеку по завершении (ровно один раз).
  if (status === "completed" && job.resultAssetId === null) {
    const created = addAsset({
      name: job.resultName,
      type: "video",
      sizeBytes: 6_000_000,
      durationSec: job.durationSec,
      width: job.width,
      height: job.height,
      fps: 30,
      tags: ["uniquized", job.profileId],
    });
    job.resultAssetId = created.id;
    JOBS.set(job.id, job);
  }
  return {
    id: job.id,
    batchId: job.batchId,
    variant: job.variant,
    profileId: job.profileId,
    progress,
    status,
    resultAssetId: job.resultAssetId,
    resultName: job.resultName,
  };
}

export function syncBatch(batchId: string): RenderJobView[] {
  return [...JOBS.values()].filter((j) => j.batchId === batchId).map(viewOf);
}
