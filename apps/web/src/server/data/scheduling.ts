import { limitsFor } from "@avastudio/shared/social";


import { isPrimeTime, type PostStatus } from "../../lib/scheduling.js";

import { listAccounts } from "./accounts.js";
import { getAsset, listAssets } from "./media.js";

import type { Platform } from "@avastudio/shared/domain";

/**
 * Планирование публикаций (Фаза 1).
 * posting_jobs создаются локально (mock-постинг). Реальный постинг — Фаза 2.
 * Лимиты — из anti-ban (ЭТАП 12.6), идемпотентность/прайм-тайм — из scheduler (ЭТАП 12.7).
 */

export interface CalendarPost {
  id: string;
  accountId: string;
  accountHandle: string;
  platform: Platform;
  assetId: string;
  assetName: string;
  scheduledAt: string;
  status: PostStatus;
  caption: string;
  error: string | null;
}

interface PostRecord extends Omit<CalendarPost, "status" | "error"> {
  resolved: PostStatus | null;
  error: string | null;
}

let seq = 0;
const STORE = new Map<string, PostRecord>();

function hashPercent(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 100;
}

/** Лениво доводит запись до финального статуса по времени (mock-воркер). */
function viewOf(rec: PostRecord, now: number): CalendarPost {
  let status: PostStatus;
  let error = rec.error;
  const ts = new Date(rec.scheduledAt).getTime();
  if (rec.resolved) {
    status = rec.resolved;
  } else if (ts > now) {
    status = "scheduled";
  } else if (ts > now - 60_000) {
    status = "posting";
  } else {
    // mock-постинг: детерминированный исход (≈15% ошибок).
    if (hashPercent(rec.id) < 15) {
      status = "failed";
      error = "mock: чекпойнт площадки";
    } else {
      status = "posted";
    }
    rec.resolved = status;
    rec.error = error;
    STORE.set(rec.id, rec);
  }
  return {
    id: rec.id,
    accountId: rec.accountId,
    accountHandle: rec.accountHandle,
    platform: rec.platform,
    assetId: rec.assetId,
    assetName: rec.assetName,
    scheduledAt: rec.scheduledAt,
    status,
    caption: rec.caption,
    error,
  };
}

export interface SchedulableAccountView {
  id: string;
  handle: string;
  platform: Platform;
  maxPostsPerDay: number;
}

export function listSchedulableAccounts(): SchedulableAccountView[] {
  return listAccounts().map((a) => ({
    id: a.id,
    handle: a.handle,
    platform: a.platform,
    maxPostsPerDay: limitsFor(a.platform).maxPostsPerDay,
  }));
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export interface ScheduleConflict {
  kind: "limit" | "prime";
  message: string;
}

/** Подсказки: превышение anti-ban лимита/день и выход за прайм-тайм. */
export function conflictsFor(input: {
  accountId: string;
  scheduledAt: string;
  excludeId?: string | undefined;
}): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  const acc = listAccounts().find((a) => a.id === input.accountId);
  if (!acc) return conflicts;

  const limit = limitsFor(acc.platform).maxPostsPerDay;
  const day = dayKey(input.scheduledAt);
  const sameDay = [...STORE.values()].filter(
    (r) => r.accountId === input.accountId && dayKey(r.scheduledAt) === day && r.id !== input.excludeId,
  ).length;
  if (sameDay >= limit) {
    conflicts.push({
      kind: "limit",
      message: `Лимит ${limit} постов/день для ${acc.platform} достигнут`,
    });
  }

  const hour = new Date(input.scheduledAt).getHours();
  if (!isPrimeTime(hour)) {
    conflicts.push({ kind: "prime", message: "Вне прайм-тайма (18:00–22:00)" });
  }
  return conflicts;
}

export function listPosts(): CalendarPost[] {
  seed();
  const now = Date.now();
  return [...STORE.values()]
    .map((r) => viewOf(r, now))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export interface SchedulePostInput {
  accountId: string;
  assetId: string;
  scheduledAt: string;
  caption?: string | undefined;
}

export function schedulePost(input: SchedulePostInput): CalendarPost {
  seed();
  const acc = listAccounts().find((a) => a.id === input.accountId);
  if (!acc) throw new Error("Аккаунт не найден");
  const asset = getAsset(input.assetId);
  if (!asset) throw new Error("Ассет не найден");

  const id = `post_${(seq += 1)}`;
  const rec: PostRecord = {
    id,
    accountId: acc.id,
    accountHandle: acc.handle,
    platform: acc.platform,
    assetId: asset.id,
    assetName: asset.name,
    scheduledAt: input.scheduledAt,
    caption: input.caption ?? "Плановая публикация",
    resolved: null,
    error: null,
  };
  STORE.set(id, rec);
  return viewOf(rec, Date.now());
}

/** Drag-and-drop перенос на новые дату/время. Сбрасывает mock-статус. */
export function reschedule(id: string, scheduledAt: string): CalendarPost {
  seed();
  const rec = STORE.get(id);
  if (!rec) throw new Error("Публикация не найдена");
  rec.scheduledAt = scheduledAt;
  rec.resolved = null;
  rec.error = null;
  STORE.set(id, rec);
  return viewOf(rec, Date.now());
}

export function removePost(id: string): { id: string } {
  STORE.delete(id);
  return { id };
}

let seeded = false;
function seed(): void {
  if (seeded) return;
  seeded = true;
  const accounts = listAccounts();
  const assets = listAssets({ type: "video" });
  if (accounts.length === 0 || assets.length === 0) return;
  const base = new Date("2026-06-02T00:00:00Z");
  const presets: Array<{ dayOffset: number; hour: number; ai: number; pi: number }> = []; // п.2: демо-расписание убрано
  for (const p of presets) {
    const acc = accounts[p.ai % accounts.length]!;
    const asset = assets[p.pi % assets.length]!;
    const when = new Date(base.getTime() + p.dayOffset * 86_400_000);
    when.setHours(p.hour, 0, 0, 0);
    const id = `post_${(seq += 1)}`;
    STORE.set(id, {
      id,
      accountId: acc.id,
      accountHandle: acc.handle,
      platform: acc.platform,
      assetId: asset.id,
      assetName: asset.name,
      scheduledAt: when.toISOString(),
      caption: "Плановая публикация",
      resolved: null,
      error: null,
    });
  }
}
