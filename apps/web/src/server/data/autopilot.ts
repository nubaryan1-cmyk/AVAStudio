import { PRIME_START, PRIME_END } from "../../lib/scheduling.js";

import { listSchedulableAccounts, schedulePost, type CalendarPost } from "./scheduling.js";

/**
 * Центр Автозалива (Фаза 1) — порт /api/autopilot|uploader старого интерфейса.
 * Берёт один ассет и набор аккаунтов, раскидывает публикации по прайм-тайму
 * (18:00–22:00) на N дней вперёд, уважая дневной лимит площадки.
 * Реальный постинг — Фаза 2; здесь создаются posting_jobs (mock-воркер).
 */

export interface AutopilotPlanInput {
  assetId: string;
  accountIds: string[];
  /** Публикаций на аккаунт (1–14). */
  postsPerAccount: number;
  caption?: string | undefined;
}

export interface AutopilotResult {
  created: number;
  posts: CalendarPost[];
}

const PRIME_HOURS: number[] = [];
for (let h = PRIME_START; h < PRIME_END; h += 1) PRIME_HOURS.push(h);

/** Детерминированная минута слота, чтобы посты не вставали в одну секунду. */
function slotMinute(accountIndex: number, n: number): number {
  return (accountIndex * 17 + n * 11) % 60;
}

export function runAutopilot(input: AutopilotPlanInput): AutopilotResult {
  const accounts = listSchedulableAccounts().filter((a) => input.accountIds.includes(a.id));
  if (accounts.length === 0) throw new Error("Не выбрано ни одного аккаунта");
  if (input.postsPerAccount < 1) throw new Error("Минимум 1 публикация на аккаунт");

  const base = new Date();
  base.setUTCHours(0, 0, 0, 0);
  const posts: CalendarPost[] = [];

  accounts.forEach((acc, ai) => {
    const perDay = Math.max(1, Math.min(acc.maxPostsPerDay, PRIME_HOURS.length));
    for (let n = 0; n < input.postsPerAccount; n += 1) {
      const dayOffset = Math.floor(n / perDay) + 1;
      const slotInDay = n % perDay;
      const hour = PRIME_HOURS[slotInDay % PRIME_HOURS.length]!;
      const when = new Date(base.getTime() + dayOffset * 86_400_000);
      when.setUTCHours(hour, slotMinute(ai, n), 0, 0);
      posts.push(
        schedulePost({
          accountId: acc.id,
          assetId: input.assetId,
          scheduledAt: when.toISOString(),
          caption: input.caption ?? "Автозалив",
        }),
      );
    }
  });

  return { created: posts.length, posts };
}
