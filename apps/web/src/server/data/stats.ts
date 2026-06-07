import { listAccounts } from "./accounts.js";

import type { Platform } from "@avastudio/shared/domain";

/**
 * Аналитика (Фаза 1) — порт /api/stats/dashboard|activity старого интерфейса.
 * Детерминированные ряды (без внешних подключений). Интерфейсы готовы под
 * реальные метрики площадок в Фазе 2.
 */

export type StatsRange = 7 | 30 | 90;

export interface MetricPoint {
  date: string;
  value: number;
}

export interface StatsSummary {
  posts: number;
  views: number;
  likes: number;
  followersGained: number;
  engagementRate: number;
}

export interface PlatformBreakdown {
  platform: Platform;
  posts: number;
  views: number;
  share: number;
}

export interface StatsOverview {
  range: StatsRange;
  summary: StatsSummary;
  views: MetricPoint[];
  posts: MetricPoint[];
  byPlatform: PlatformBreakdown[];
}

/** Детерминированный псевдослучайный множитель из строки. */
function seed(s: string): number {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

function series(range: StatsRange, base: number, swing: number, key: string): MetricPoint[] {
  const out: MetricPoint[] = [];
  const now = Date.UTC(2026, 5, 2);
  for (let i = range - 1; i >= 0; i -= 1) {
    const d = new Date(now - i * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    const wave = Math.sin((range - i) / 3) * 0.5 + 0.5;
    const noise = seed(`${key}-${iso}`);
    const value = Math.round(base + swing * (0.6 * wave + 0.4 * noise));
    out.push({ date: iso, value });
  }
  return out;
}

const PLATFORMS: Platform[] = ["instagram", "tiktok", "reddit", "threads"];

export function getStatsOverview(range: StatsRange = 30): StatsOverview {
  const accountsCount = Math.max(1, listAccounts().length);
  const views = series(range, 1800 * accountsCount, 2600 * accountsCount, "views");
  const posts = series(range, 3, 6, "posts");

  const totalPosts = posts.reduce((s, p) => s + p.value, 0);
  const totalViews = views.reduce((s, p) => s + p.value, 0);
  const likes = Math.round(totalViews * 0.071);
  const followersGained = Math.round(totalViews * 0.0042);
  const engagementRate = totalViews > 0 ? Math.round((likes / totalViews) * 1000) / 10 : 0;

  const weights = PLATFORMS.map((p) => 0.5 + seed(`w-${p}`));
  const wSum = weights.reduce((s, w) => s + w, 0);
  const byPlatform: PlatformBreakdown[] = PLATFORMS.map((platform, i) => {
    const share = Math.round((weights[i]! / wSum) * 1000) / 10;
    return {
      platform,
      posts: Math.round(totalPosts * (weights[i]! / wSum)),
      views: Math.round(totalViews * (weights[i]! / wSum)),
      share,
    };
  });

  return {
    range,
    summary: { posts: totalPosts, views: totalViews, likes, followersGained, engagementRate },
    views,
    posts,
    byPlatform,
  };
}
