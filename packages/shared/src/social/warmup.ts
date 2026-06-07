/**
 * Движок прогрева аккаунтов (TASK 12.5). Новый аккаунт 7–14 дней имитирует
 * естественную активность (скролл, лайки, подписки, сторис) с эскалацией по дням и
 * рандомизацией, иначе бан. Аккаунт не допускается к постингу, пока не прогрет.
 * Чистая логика (без сети); исполнение действий — драйвер платформы (12.4), Фаза 2.
 */
import { randomDelayMs, randomInt } from "../utils/random.js";

import type { Platform } from "../domain/enums.js";
import type { SocialAccountId } from "../domain/ids.js";

/** Полный цикл прогрева — 14 дней (день 14 ⇒ почти полная активность). */
export const WARMUP_TOTAL_DAYS = 14;

export const WARMUP_ACTIONS = [
  "scroll_feed",
  "like",
  "follow",
  "view_story",
  "watch_reels",
] as const;
export type WarmupActionKind = (typeof WARMUP_ACTIONS)[number];

/** Одно действие прогрева с паузой перед ним (имитация человека). */
export interface WarmupAction {
  kind: WarmupActionKind;
  /** Пауза перед действием, мс (рандомизирована). */
  pauseMs: number;
}

/**
 * Параметры прогрева для платформы: максимумы действий «на полном прогреве» (день 14).
 * Реальные значения дня масштабируются фактором эскалации.
 */
export interface WarmupPlatformParams {
  /** Максимум действий за сессию на полном прогреве. */
  maxActionsPerSession: number;
  /** Длительность сессии на полном прогреве, мс. */
  maxSessionMs: number;
  /** Допустимые виды действий на платформе. */
  actions: readonly WarmupActionKind[];
}

const DEFAULT_PARAMS: WarmupPlatformParams = {
  maxActionsPerSession: 40,
  maxSessionMs: 15 * 60_000,
  actions: WARMUP_ACTIONS,
};

const PLATFORM_PARAMS: Partial<Record<Platform, WarmupPlatformParams>> = {
  instagram: { maxActionsPerSession: 40, maxSessionMs: 15 * 60_000, actions: WARMUP_ACTIONS },
  tiktok: {
    maxActionsPerSession: 60,
    maxSessionMs: 20 * 60_000,
    actions: ["scroll_feed", "like", "follow", "watch_reels"],
  },
  reddit: {
    maxActionsPerSession: 25,
    maxSessionMs: 10 * 60_000,
    actions: ["scroll_feed", "like"],
  },
  threads: {
    maxActionsPerSession: 30,
    maxSessionMs: 10 * 60_000,
    actions: ["scroll_feed", "like", "follow"],
  },
};

/** Параметры прогрева платформы (или дефолт). */
export function warmupParams(platform: Platform): WarmupPlatformParams {
  return PLATFORM_PARAMS[platform] ?? DEFAULT_PARAMS;
}

/** Нормализует номер дня в диапазон 1..WARMUP_TOTAL_DAYS. */
export function clampWarmupDay(day: number): number {
  if (day < 1) return 1;
  if (day > WARMUP_TOTAL_DAYS) return WARMUP_TOTAL_DAYS;
  return Math.floor(day);
}

/**
 * Фактор эскалации для дня (0<f≤1). День 1 — минимум активности, день 14 — полная.
 * Линейная эскалация day/total.
 */
export function escalationFactor(day: number): number {
  return clampWarmupDay(day) / WARMUP_TOTAL_DAYS;
}

/** Номер дня прогрева (1-based) по дате старта. */
export function warmupDay(startedAt: Date, now: Date = new Date()): number {
  const elapsedMs = now.getTime() - startedAt.getTime();
  const day = Math.floor(elapsedMs / 86_400_000) + 1;
  return clampWarmupDay(day);
}

/** План сессии прогрева на день: набор действий с паузами + длительность. */
export interface WarmupSessionPlan {
  platform: Platform;
  day: number;
  /** Целевая длительность сессии, мс (эскалирована + рандомизирована). */
  durationMs: number;
  actions: readonly WarmupAction[];
}

/**
 * Строит план сессии прогрева для платформы и дня. Кол-во действий и длительность
 * масштабируются фактором эскалации; виды действий и паузы рандомизированы.
 */
export function planWarmupSession(platform: Platform, day: number): WarmupSessionPlan {
  const params = warmupParams(platform);
  const factor = escalationFactor(day);
  const targetActions = Math.max(1, Math.round(params.maxActionsPerSession * factor));
  // Рандомизация ±20% вокруг целевого числа действий.
  const lo = Math.max(1, Math.floor(targetActions * 0.8));
  const hi = Math.max(lo, Math.ceil(targetActions * 1.2));
  const count = randomInt(lo, hi + 1);
  const kinds = params.actions;
  const actions: WarmupAction[] = [];
  for (let i = 0; i < count; i += 1) {
    const kind = kinds[randomInt(0, kinds.length)] ?? kinds[0] ?? "scroll_feed";
    actions.push({ kind, pauseMs: randomDelayMs(800, 4_000) });
  }
  const durationMs = Math.round(params.maxSessionMs * factor);
  return { platform, day: clampWarmupDay(day), durationMs, actions };
}

/** Состояние прогрева аккаунта (зеркало полей БД: warmup_started_at, warmup_stage). */
export interface WarmupState {
  accountId: SocialAccountId;
  platform: Platform;
  warmupStartedAt?: Date;
  /** Достигнутая стадия (день) прогрева; WARMUP_TOTAL_DAYS ⇒ прогрет. */
  warmupStage: number;
}

/** Прогрет ли аккаунт (готов к постингу). */
export function isWarmedUp(state: WarmupState): boolean {
  return state.warmupStage >= WARMUP_TOTAL_DAYS;
}

/**
 * Гейт постинга: бросает, если аккаунт ещё не прогрет. Вызывается перед публикацией
 * (scheduler/постинг-процессор, 12.7).
 */
export function assertReadyToPost(state: WarmupState): void {
  if (!isWarmedUp(state)) {
    throw new Error(
      `аккаунт ${state.accountId} не прогрет (стадия ${state.warmupStage}/${WARMUP_TOTAL_DAYS})`,
    );
  }
}

/**
 * Порт репозитория состояния прогрева (адаптер БД — ЭТАП 4). Хранит warmup_started_at
 * и warmup_stage per account.
 */
export interface WarmupRepository {
  get(accountId: SocialAccountId): Promise<WarmupState | undefined>;
  save(state: WarmupState): Promise<void>;
}

/** In-memory реализация для Фазы 1/тестов. */
export class InMemoryWarmupRepository implements WarmupRepository {
  private readonly byAccount = new Map<string, WarmupState>();

  async get(accountId: SocialAccountId): Promise<WarmupState | undefined> {
    return this.byAccount.get(accountId);
  }

  async save(state: WarmupState): Promise<void> {
    this.byAccount.set(state.accountId, state);
  }
}
