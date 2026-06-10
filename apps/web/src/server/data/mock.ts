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
  accounts: 0,
  renders: 0,
  videoMinutes: 0,
  seats: 1,
  aiGenerations: 0,
  posts: 0,
};

export function getDashboardData(): DashboardData {
  const usage: UsageRow[] = (Object.keys(DEMO_PLAN.limits) as LimitMetric[]).map((metric) => ({
    metric,
    used: USED[metric],
    limit: DEMO_PLAN.limits[metric],
  }));

  return {
    accountsCount: 0,
    postsThisWeek: 0,
    recentJobs: [],
    usage,
    issues: [],
  };
}
