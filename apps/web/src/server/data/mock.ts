import { PLANS, type LimitMetric } from "@avastudio/shared/billing";

import type { Platform } from "@avastudio/shared/domain";

/** Локальный источник данных дашборда (Фаза 1: детерминированные моки). */

export interface JobStatusItem {
  id: string;
  kind: "render" | "post" | "warmup";
  platform: Platform | null;
  status: "completed" | "active" | "failed" | "waiting";
  at: string;
}

export interface AccountIssue {
  accountId: string;
  handle: string;
  platform: Platform;
  kind: "checkpoint" | "shadowban_suspected" | "error";
  message: string;
}

export interface UsageRow {
  metric: LimitMetric;
  used: number;
  limit: number | null;
}

export interface DashboardData {
  accountsCount: number;
  postsThisWeek: number;
  recentJobs: JobStatusItem[];
  usage: UsageRow[];
  issues: AccountIssue[];
}

const DEMO_PLAN = PLANS.pro;

const USED: Record<LimitMetric, number> = {
  accounts: 7,
  renders: 142,
  videoMinutes: 138,
  seats: 1,
  aiGenerations: 210,
  posts: 96,
};

export function getDashboardData(): DashboardData {
  const usage: UsageRow[] = (Object.keys(DEMO_PLAN.limits) as LimitMetric[]).map((metric) => ({
    metric,
    used: USED[metric],
    limit: DEMO_PLAN.limits[metric],
  }));

  return {
    accountsCount: 7,
    postsThisWeek: 96,
    recentJobs: [
      { id: "j1", kind: "post", platform: "instagram", status: "completed", at: "2026-05-30T09:12:00Z" },
      { id: "j2", kind: "render", platform: null, status: "active", at: "2026-05-30T09:30:00Z" },
      { id: "j3", kind: "post", platform: "tiktok", status: "waiting", at: "2026-05-30T10:00:00Z" },
      { id: "j4", kind: "warmup", platform: "threads", status: "completed", at: "2026-05-30T08:00:00Z" },
      { id: "j5", kind: "post", platform: "reddit", status: "failed", at: "2026-05-30T07:45:00Z" },
    ],
    usage,
    issues: [
      {
        accountId: "acc_12",
        handle: "@brand.reels",
        platform: "instagram",
        kind: "checkpoint",
        message: "Площадка запросила подтверждение — аккаунт на паузе.",
      },
      {
        accountId: "acc_8",
        handle: "@promo.short",
        platform: "tiktok",
        kind: "shadowban_suspected",
        message: "Снижение охвата — проверьте активность.",
      },
    ],
  };
}
