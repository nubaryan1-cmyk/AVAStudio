import type { LimitMetric } from "@avastudio/shared/billing";
import type { Money } from "@avastudio/shared/payments";

export const METRIC_LABELS: Record<LimitMetric, string> = {
  accounts: "Аккаунты",
  renders: "Рендеры",
  videoMinutes: "Минуты видео",
  seats: "Места",
  aiGenerations: "AI-генерации",
  posts: "Публикации",
};

export type PaymentMethod = "card" | "crypto";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  card: "Картой",
  crypto: "Криптовалютой",
};

export function formatMoney(m: Money): string {
  if (m.kind === "crypto") return `${m.amount} ${m.currency}`;
  const symbol = m.currency === "USD" ? "$" : `${m.currency} `;
  return `${symbol}${m.amount}`;
}

export type UsageLevel = "good" | "warning" | "bad";

export function usageLevel(ratio: number): UsageLevel {
  if (ratio >= 0.9) return "bad";
  if (ratio >= 0.7) return "warning";
  return "good";
}
