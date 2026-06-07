import type { AccountStatus } from "../server/data/accounts.js";
import type { ImplMechanism } from "@avastudio/shared/social";

export const STATUS_LABELS: Record<AccountStatus, string> = {
  warmup: "Прогрев",
  active: "Активен",
  checkpoint: "Checkpoint",
  authorized: "Авторизован",
};

export const MECHANISM_LABELS: Record<ImplMechanism, string> = {
  api: "API",
  browser: "Через браузер",
  phone: "Через телефон (PhonePool)",
};

export type HealthLevel = "good" | "warning" | "bad";

/** Уровень health по баллу 0..100. */
export function healthLevel(score: number): HealthLevel {
  if (score >= 75) return "good";
  if (score >= 50) return "warning";
  return "bad";
}
