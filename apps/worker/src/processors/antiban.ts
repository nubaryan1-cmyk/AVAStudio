/**
 * Anti-ban: безопасные лимиты и человекоподобное поведение (AB.5/AB.6/AB.7).
 * Цель — выживаемость аккаунтов. Лимиты намеренно ниже официальных порогов IG.
 */

/** Лимиты действий (консервативные, для новых аккаунтов). */
export const LIMITS = {
  likesPerHour: { min: 2, max: 4 }, // ВАЖНО: держать 2–4 лайка/час, не больше
  followsPerDay: { min: 10, max: 30 },
  unfollowsPerDay: { min: 20, max: 40 },
  dmPerDay: { min: 1, max: 5 },
  /** Часы «сна» по локальному времени аккаунта (без активности). */
  quietHours: { start: 0, end: 7 },
} as const;

const rnd = (min: number, max: number): number => Math.floor(min + Math.random() * (max - min + 1));

/** Человеческая пауза с джиттером (мс). */
export const humanPause = (baseMs: number): Promise<void> =>
  new Promise((r) => setTimeout(r, Math.max(300, baseMs + rnd(-400, 1200))));

/** Сколько лайков допустимо за ОДИН прогон (час), чтобы держать 2–4/час. */
export const likeBudgetForRun = (): number => rnd(LIMITS.likesPerHour.min, LIMITS.likesPerHour.max);

/** Сейчас «тихие часы» аккаунта? tzOffset — смещение часового пояса аккаунта от UTC. */
export function isQuietHours(tzOffsetHours = 0, now: Date = new Date()): boolean {
  const localHour = (now.getUTCHours() + tzOffsetHours + 24) % 24;
  const { start, end } = LIMITS.quietHours;
  return localHour >= start && localHour < end;
}

/** Красные линии контента — мгновенный перманентный бан. Блокируем на входе. */
export const RED_LINE_TERMS = [
  "child", "minor", "cp", "underage",
  "террор", "terror", "weapon", "оружие",
  "наркотик", "drugs", "scam", "обнал",
];

/** Безопасен ли текст (нет красных линий). */
export function isContentSafe(text: string): boolean {
  const t = text.toLowerCase();
  return !RED_LINE_TERMS.some((term) => t.includes(term));
}

/** Вариативная подпись (анти-дубликат между аккаунтами). */
export function varyCaption(base: string, extras: string[] = []): string {
  const tails = ["", " ✨", " 🔥", " 💯", " 👀", "...", " !", " 🙌"];
  const tail = tails[rnd(0, tails.length - 1)] ?? "";
  const extra = extras.length ? ` ${extras[rnd(0, extras.length - 1)]}` : "";
  return `${base}${extra}${tail}`;
}

/** Выбрать n случайных хештегов из пула (без перегруза — спам-сигнал). */
export function pickHashtags(pool: string[], n: number): string[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.max(0, Math.min(n, pool.length)));
}
