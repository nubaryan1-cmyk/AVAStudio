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

const CHART: ReadonlyArray<Omit<TrendTrack, "rank" | "usesCount">> = []; // п.2: фейковый чарт убран

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
