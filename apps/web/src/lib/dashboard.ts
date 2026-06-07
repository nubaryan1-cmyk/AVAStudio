import type { LimitMetric } from "@avastudio/shared/billing";

export const METRIC_LABELS: Record<LimitMetric, string> = {
  accounts: "Аккаунты",
  renders: "Рендеры",
  videoMinutes: "Минуты видео",
  seats: "Места в команде",
  aiGenerations: "AI-генерации",
  posts: "Публикации",
};

/** Процент использования лимита (0..100). null-лимит = безлимит → 0%. */
export function usagePercent(used: number, limit: number | null): number {
  if (limit === null || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}
