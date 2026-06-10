import { PROBE_LIMITS, validateProbeData, type ProbeData } from "@avastudio/media";
import { asMediaAssetId, type MediaAssetId, type MediaType } from "@avastudio/shared/domain";

import { LocalStorageAdapter, type StorageAdapter } from "../storage/local-adapter.js";

/**
 * Локальная медиатека (Фаза 1).
 * Загрузка проходит ffprobe-валидацию (ЭТАП 6.2) против PROBE_LIMITS.
 * Облачное Storage — Фаза 2; здесь — LocalStorageAdapter.
 */

export interface MediaAssetRecord {
  id: MediaAssetId;
  name: string;
  type: MediaType;
  storagePath: string;
  sizeBytes: number;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  tags: string[];
  createdAt: string;
  /** Метаданные ffprobe (для видео). */
  probe: ProbeData | null;
}

export interface ListAssetsFilter {
  type?: MediaType | undefined;
  search?: string | undefined;
  tags?: string[] | undefined;
}

export interface AddAssetInput {
  name: string;
  type: MediaType;
  sizeBytes: number;
  durationSec: number;
  width: number;
  height: number;
  fps?: number | undefined;
  tags: string[];
}

const storage: StorageAdapter = new LocalStorageAdapter();
let seq = 0;
const STORE = new Map<string, MediaAssetRecord>();

function buildProbe(input: AddAssetInput): ProbeData {
  return {
    durationSec: input.durationSec,
    sizeBytes: input.sizeBytes,
    bitrate: null,
    streamCount: 2,
    video: { codec: "h264", width: input.width, height: input.height, fps: input.fps ?? 30 },
    audio: { codec: "aac", channels: 2 },
  };
}

/** Валидация загрузки. Видео — через validateProbeData (ffprobe-лимиты ЭТАП 6.2). */
function validateUpload(input: AddAssetInput): ProbeData | null {
  if (input.sizeBytes > PROBE_LIMITS.MAX_SIZE_BYTES) {
    throw new Error("Файл больше 500 МБ");
  }
  if (input.type === "video") {
    return validateProbeData(buildProbe(input));
  }
  if (input.width > PROBE_LIMITS.MAX_WIDTH || input.height > PROBE_LIMITS.MAX_HEIGHT) {
    throw new Error("Разрешение превышает 4K");
  }
  return null;
}

function seed(): void {
  if (STORE.size > 0) return;
  // Демо-медиа убрано (п.2): медиатека начинается пустой и наполняется загрузками пользователя.
  const presets: AddAssetInput[] = [];
  for (const p of presets) void insert(p, "2026-05-29T10:00:00Z");
}

function insert(input: AddAssetInput, createdAt: string): MediaAssetRecord {
  const probe = validateUpload(input);
  const id = `media_${(seq += 1)}`;
  const storagePath = `${id}/${input.name}`;
  void storage.put(storagePath, new Uint8Array(0));
  const record: MediaAssetRecord = {
    id: asMediaAssetId(id),
    name: input.name,
    type: input.type,
    storagePath,
    sizeBytes: input.sizeBytes,
    durationSec: input.type === "image" ? null : input.durationSec,
    width: input.type === "audio" ? null : input.width,
    height: input.type === "audio" ? null : input.height,
    tags: input.tags,
    createdAt,
    probe,
  };
  STORE.set(id, record);
  return record;
}

export function listAssets(filter?: ListAssetsFilter): MediaAssetRecord[] {
  seed();
  let all = [...STORE.values()];
  if (filter?.type) all = all.filter((a) => a.type === filter.type);
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    all = all.filter((a) => a.name.toLowerCase().includes(q) || a.tags.some((t) => t.toLowerCase().includes(q)));
  }
  if (filter?.tags && filter.tags.length > 0) {
    all = all.filter((a) => filter.tags!.every((t) => a.tags.includes(t)));
  }
  return all.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
}

export function getAsset(id: string): MediaAssetRecord | null {
  seed();
  return STORE.get(id) ?? null;
}

export function addAsset(input: AddAssetInput): MediaAssetRecord {
  seed();
  return insert(input, new Date().toISOString());
}

export function allTags(): string[] {
  seed();
  const set = new Set<string>();
  for (const a of STORE.values()) for (const t of a.tags) set.add(t);
  return [...set].sort();
}
