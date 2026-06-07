/**
 * Anti-ban логика (TASK 12.6). Главный риск проекта — баны соцсетей. Здесь rule-based
 * защита: лимиты per platform/account (посты/день, действия/час, паузы 30с–5мин),
 * рандомизация (подписи/задержки/jitter), детектор shadowban (падение reach) и
 * checkpoint/challenge → авто-стоп аккаунта + флаг. Состояние здоровья (health_score,
 * last_checkpoint) — в БД. ML-скоринг — Фаза 2 (ЭТАП 25). Фаза 1 — mock/чистая логика.
 */
import { jitter, randomChoice, randomDelayMs } from "../utils/random.js";

import type { AccountStatus, Platform } from "../domain/enums.js";
import type { SocialAccountId } from "../domain/ids.js";

/** Лимиты активности для платформы/аккаунта. */
export interface AntiBanLimits {
  maxPostsPerDay: number;
  maxActionsPerHour: number;
  /** Минимальная пауза между действиями, мс (нижняя граница ~30с). */
  minPauseMs: number;
  /** Максимальная пауза между действиями, мс (верхняя граница ~5мин). */
  maxPauseMs: number;
}

const THIRTY_SEC = 30_000;
const FIVE_MIN = 5 * 60_000;

const DEFAULT_LIMITS: AntiBanLimits = {
  maxPostsPerDay: 5,
  maxActionsPerHour: 30,
  minPauseMs: THIRTY_SEC,
  maxPauseMs: FIVE_MIN,
};

const PLATFORM_LIMITS: Partial<Record<Platform, AntiBanLimits>> = {
  instagram: { maxPostsPerDay: 3, maxActionsPerHour: 25, minPauseMs: THIRTY_SEC, maxPauseMs: FIVE_MIN },
  tiktok: { maxPostsPerDay: 5, maxActionsPerHour: 40, minPauseMs: THIRTY_SEC, maxPauseMs: FIVE_MIN },
  reddit: { maxPostsPerDay: 10, maxActionsPerHour: 20, minPauseMs: 60_000, maxPauseMs: FIVE_MIN },
  threads: { maxPostsPerDay: 8, maxActionsPerHour: 30, minPauseMs: THIRTY_SEC, maxPauseMs: FIVE_MIN },
};

/** Лимиты платформы (или дефолт). */
export function limitsFor(platform: Platform): AntiBanLimits {
  return PLATFORM_LIMITS[platform] ?? DEFAULT_LIMITS;
}

/** Окно активности (счётчики с привязкой к началу суток/часа). */
export interface ActivityWindow {
  postsToday: number;
  dayStartMs: number;
  actionsThisHour: number;
  hourStartMs: number;
}

/** Пустое окно на момент now. */
export function freshWindow(now: Date = new Date()): ActivityWindow {
  const t = now.getTime();
  return { postsToday: 0, dayStartMs: t, actionsThisHour: 0, hourStartMs: t };
}

/** Сбрасывает счётчики, если соответствующее окно (сутки/час) истекло. */
export function rollWindow(win: ActivityWindow, now: Date = new Date()): ActivityWindow {
  const t = now.getTime();
  let next = { ...win };
  if (t - win.dayStartMs >= 86_400_000) {
    next = { ...next, postsToday: 0, dayStartMs: t };
  }
  if (t - win.hourStartMs >= 3_600_000) {
    next = { ...next, actionsThisHour: 0, hourStartMs: t };
  }
  return next;
}

export interface LimitDecision {
  allowed: boolean;
  reason?: string;
}

/** Можно ли опубликовать пост сейчас (лимиты постов/день и действий/час). */
export function checkPostAllowed(
  limits: AntiBanLimits,
  win: ActivityWindow,
  now: Date = new Date(),
): LimitDecision {
  const w = rollWindow(win, now);
  if (w.postsToday >= limits.maxPostsPerDay) {
    return { allowed: false, reason: `превышен лимит постов/день (${limits.maxPostsPerDay})` };
  }
  if (w.actionsThisHour >= limits.maxActionsPerHour) {
    return { allowed: false, reason: `превышен лимит действий/час (${limits.maxActionsPerHour})` };
  }
  return { allowed: true };
}

/** Бросает, если публиковать нельзя (гейт перед постингом, 12.7). */
export function assertPostAllowed(
  limits: AntiBanLimits,
  win: ActivityWindow,
  now: Date = new Date(),
): void {
  const decision = checkPostAllowed(limits, win, now);
  if (!decision.allowed) {
    throw new Error(`anti-ban: ${decision.reason}`);
  }
}

/** Регистрирует совершённый пост (увеличивает счётчики с учётом перекатки окон). */
export function registerPost(win: ActivityWindow, now: Date = new Date()): ActivityWindow {
  const w = rollWindow(win, now);
  return { ...w, postsToday: w.postsToday + 1, actionsThisHour: w.actionsThisHour + 1 };
}

/** Человекоподобная пауза перед действием: случайно в [minPause, maxPause]. */
export function nextActionPauseMs(limits: AntiBanLimits): number {
  return randomDelayMs(limits.minPauseMs, limits.maxPauseMs);
}

/** Jitter поверх базовой задержки (±factor). */
export function jitteredDelay(baseMs: number, factor = 0.2): number {
  return jitter(baseMs, factor);
}

/** Выбирает вариант подписи (рандомизация — не публиковать одинаковые тексты). */
export function randomizedCaption(variants: readonly string[]): string {
  return randomChoice(variants);
}

/** Сигнал от платформы по итогу действия. */
export type PlatformSignalKind = "ok" | "error" | "checkpoint" | "challenge";

export interface PlatformSignal {
  kind: PlatformSignalKind;
  /** Reach последнего поста (для детектора shadowban). */
  reach?: number;
}

/** Состояние здоровья аккаунта (зеркало БД: health_score, status, last_checkpoint). */
export interface AccountHealth {
  accountId: SocialAccountId;
  platform: Platform;
  /** 0..100; падает на ошибках/shadowban, обнуляется на checkpoint. */
  healthScore: number;
  status: AccountStatus;
  lastCheckpointAt?: Date;
  consecutiveErrors: number;
  /** Базовый reach для сравнения (среднее «здорового» периода). */
  baselineReach?: number;
  /** Последние значения reach (скользящее окно). */
  recentReach: readonly number[];
}

/** Доля от baseline, ниже которой подозреваем shadowban. */
export const SHADOWBAN_REACH_RATIO = 0.3;
const RECENT_REACH_WINDOW = 5;
const HEALTH_ERROR_PENALTY = 15;
const HEALTH_OK_RECOVERY = 5;

/** Среднее последних reach (или undefined, если данных нет). */
function avg(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Подозрение на shadowban: средний recent reach упал ниже SHADOWBAN_REACH_RATIO от
 * baseline (нужно достаточно наблюдений). Rule-based, ML — Фаза 2.
 */
export function detectShadowban(health: AccountHealth): boolean {
  if (health.baselineReach === undefined || health.recentReach.length < 3) {
    return false;
  }
  const recentAvg = avg(health.recentReach);
  if (recentAvg === undefined) return false;
  return recentAvg < health.baselineReach * SHADOWBAN_REACH_RATIO;
}

/** Остановлен ли аккаунт (не допускается к действиям). */
export function isStopped(health: AccountHealth): boolean {
  return (
    health.status === "checkpoint" || health.status === "banned" || health.status === "disabled"
  );
}

/**
 * Применяет сигнал платформы к здоровью аккаунта. checkpoint/challenge → авто-стоп
 * (status=checkpoint, score=0, фиксируем last_checkpoint). error → штраф score +
 * счётчик ошибок. ok → восстановление score, сброс счётчика, обновление reach и
 * детектор shadowban (при срабатывании — авто-пауза: status=checkpoint как стоп-флаг).
 */
export function applySignal(
  health: AccountHealth,
  signal: PlatformSignal,
  now: Date = new Date(),
): AccountHealth {
  if (signal.kind === "checkpoint" || signal.kind === "challenge") {
    return {
      ...health,
      status: "checkpoint",
      healthScore: 0,
      lastCheckpointAt: now,
      consecutiveErrors: health.consecutiveErrors + 1,
    };
  }
  if (signal.kind === "error") {
    return {
      ...health,
      healthScore: Math.max(0, health.healthScore - HEALTH_ERROR_PENALTY),
      consecutiveErrors: health.consecutiveErrors + 1,
    };
  }
  // kind === "ok"
  const recentReach =
    signal.reach !== undefined
      ? [...health.recentReach, signal.reach].slice(-RECENT_REACH_WINDOW)
      : health.recentReach;
  const candidate: AccountHealth = {
    ...health,
    healthScore: Math.min(100, health.healthScore + HEALTH_OK_RECOVERY),
    consecutiveErrors: 0,
    recentReach,
  };
  if (detectShadowban(candidate)) {
    // Авто-пауза по подозрению на shadowban: помечаем checkpoint как стоп-флаг + алерт.
    return { ...candidate, status: "checkpoint", lastCheckpointAt: now };
  }
  return candidate;
}

/** Порт репозитория здоровья аккаунтов (адаптер БД — ЭТАП 4). */
export interface AccountHealthRepository {
  get(accountId: SocialAccountId): Promise<AccountHealth | undefined>;
  save(health: AccountHealth): Promise<void>;
}

/** In-memory реализация для Фазы 1/тестов. */
export class InMemoryAccountHealthRepository implements AccountHealthRepository {
  private readonly byAccount = new Map<string, AccountHealth>();

  async get(accountId: SocialAccountId): Promise<AccountHealth | undefined> {
    return this.byAccount.get(accountId);
  }

  async save(health: AccountHealth): Promise<void> {
    this.byAccount.set(health.accountId, health);
  }
}
