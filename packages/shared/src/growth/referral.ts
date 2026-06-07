/**
 * Referral + affiliate (TASK 26.4). Чистая логика: генерация кодов, атрибуция,
 * расчёт revshare поверх платёжной абстракции (ЭТАП 19). Деньги — number с округлением.
 */
import { createHash } from "node:crypto";

/** Детерминированный реферальный код из userId (стабильный, шарящийся). */
export function referralCode(userId: string): string {
  return createHash("sha256").update(`ref:${userId}`).digest("hex").slice(0, 8).toUpperCase();
}

export interface ReferralAttribution {
  referrerUserId: string;
  referredUserId: string;
  at: Date;
}

export interface RevshareConfig {
  /** Доля revshare (0..1), напр. 0.1 = 10%. */
  rate: number;
  /** Длительность начислений в месяцах (0 = бессрочно). */
  durationMonths: number;
}

export const DEFAULT_REVSHARE: RevshareConfig = { rate: 0.1, durationMonths: 12 };

/** Комиссия реферера с платежа реферала. */
export function revshareAmount(paymentUsd: number, cfg: RevshareConfig = DEFAULT_REVSHARE): number {
  return Math.round(paymentUsd * cfg.rate * 100) / 100;
}

/** Действует ли ещё начисление (по числу прошедших месяцев). */
export function revshareActive(monthsSinceJoin: number, cfg: RevshareConfig = DEFAULT_REVSHARE): boolean {
  if (cfg.durationMonths === 0) return true;
  return monthsSinceJoin < cfg.durationMonths;
}

/** Сводка по рефереру: число приглашённых + суммарная комиссия. */
export interface ReferralStats {
  referrerUserId: string;
  referredCount: number;
  totalEarnedUsd: number;
}

export function aggregateReferral(
  referrerUserId: string,
  payments: ReadonlyArray<{ paymentUsd: number; monthsSinceJoin: number }>,
  cfg: RevshareConfig = DEFAULT_REVSHARE,
): ReferralStats {
  let total = 0;
  const referred = new Set<number>();
  payments.forEach((p, i) => {
    referred.add(i);
    if (revshareActive(p.monthsSinceJoin, cfg)) total += revshareAmount(p.paymentUsd, cfg);
  });
  return { referrerUserId, referredCount: payments.length, totalEarnedUsd: Math.round(total * 100) / 100 };
}

/** Email-цепочки (Loops/Resend) — декларация шагов. */
export const EMAIL_SEQUENCES = {
  welcome: [{ day: 0, template: "welcome" }],
  onboarding: [
    { day: 1, template: "onboarding_day1" },
    { day: 3, template: "onboarding_day3" },
    { day: 7, template: "onboarding_day7" },
  ],
  reengagement: [{ day: 30, template: "reengagement_30d" }],
} as const;
