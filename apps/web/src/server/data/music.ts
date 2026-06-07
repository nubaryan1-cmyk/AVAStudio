import { addAsset, getAsset, type MediaAssetRecord } from "./media.js";

/**
 * Музыка (Фаза 1).
 * Тренды — детерминированный mock-чарт (интерфейс под реальные Deezer/Apple API в Фазе 2).
 * Микшер — склейка аудио-ассетов медиатеки в новый аудио-ассет (mock-рендер).
 */

export type MusicPlatform = "tiktok" | "instagram" | "youtube";

export interface TrendTrack {
  id: string;
  title: string;
  artist: string;
  platform: MusicPlatform;
  rank: number;
  /** Число использований за неделю (детерминированная метрика популярности). */
  usesCount: number;
  durationSec: number;
}

export interface TrendsFilter {
  platform?: MusicPlatform | undefined;
  limit?: number | undefined;
}

const CHART: ReadonlyArray<Omit<TrendTrack, "rank" | "usesCount">> = [
  { id: "trk_1", title: "Neon Skyline", artist: "Aurora Vale", platform: "tiktok", durationSec: 18 },
  { id: "trk_2", title: "Paper Planes", artist: "Mid Nyte", platform: "tiktok", durationSec: 22 },
  { id: "trk_3", title: "Golden Hour Drive", artist: "Ksenia R", platform: "instagram", durationSec: 27 },
  { id: "trk_4", title: "Slow Motion", artist: "Volt&Co", platform: "tiktok", durationSec: 15 },
  { id: "trk_5", title: "Velvet Echoes", artist: "Lune", platform: "instagram", durationSec: 30 },
  { id: "trk_6", title: "City Lights Fade", artist: "Norok", platform: "youtube", durationSec: 24 },
  { id: "trk_7", title: "Falling Up", artist: "Sable", platform: "tiktok", durationSec: 19 },
  { id: "trk_8", title: "Midnight Bloom", artist: "Aria K", platform: "instagram", durationSec: 26 },
  { id: "trk_9", title: "Static Dreams", artist: "Pulse Theory", platform: "youtube", durationSec: 31 },
  { id: "trk_10", title: "Coastline", artist: "Mara V", platform: "tiktok", durationSec: 17 },
  { id: "trk_11", title: "Afterglow", artist: "Hollow Sun", platform: "instagram", durationSec: 28 },
  { id: "trk_12", title: "Run It Back", artist: "Dex M", platform: "youtube", durationSec: 21 },
];

/** Детерминированная метрика использований: зависит только от индекса. */
function usesFor(index: number): number {
  return 500_000 - index * 37_000 + ((index * 7919) % 9_000);
}

export function listTrends(filter?: TrendsFilter): TrendTrack[] {
  let rows = CHART.map((t, i) => ({ ...t, rank: 0, usesCount: usesFor(i) }));
  if (filter?.platform) rows = rows.filter((t) => t.platform === filter.platform);
  rows.sort((a, b) => b.usesCount - a.usesCount);
  rows = rows.map((t, i) => ({ ...t, rank: i + 1 }));
  if (filter?.limit && filter.limit > 0) rows = rows.slice(0, filter.limit);
  return rows;
}

export function getTrend(id: string): TrendTrack | null {
  return listTrends().find((t) => t.id === id) ?? null;
}

/** Импорт тренд-трека в медиатеку как аудио-ассет (mock). */
export function importTrend(id: string): MediaAssetRecord {
  const trend = getTrend(id);
  if (!trend) throw new Error("Трек не найден в чарте");
  return addAsset({
    name: `${trend.artist} - ${trend.title}.mp3`,
    type: "audio",
    sizeBytes: Math.round(trend.durationSec * 40_000),
    durationSec: trend.durationSec,
    width: 0,
    height: 0,
    tags: ["trend", trend.platform],
  });
}

export interface CreateMixInput {
  name: string;
  trackIds: string[];
}

/** Микшер: склейка выбранных аудио-ассетов в новый аудио-ассет (mock-рендер). */
export function createMix(input: CreateMixInput): MediaAssetRecord {
  if (input.trackIds.length < 2) throw new Error("Нужно минимум 2 трека для микса");
  const sources = input.trackIds.map((id) => {
    const a = getAsset(id);
    if (!a) throw new Error(`Ассет ${id} не найден`);
    if (a.type !== "audio") throw new Error(`Ассет ${a.name} не является аудио`);
    return a;
  });
  const durationSec = Math.round(sources.reduce((s, a) => s + (a.durationSec ?? 0), 0));
  const sizeBytes = sources.reduce((s, a) => s + a.sizeBytes, 0);
  return addAsset({
    name: `${input.name}.mp3`,
    type: "audio",
    sizeBytes,
    durationSec,
    width: 0,
    height: 0,
    tags: ["mix"],
  });
}
