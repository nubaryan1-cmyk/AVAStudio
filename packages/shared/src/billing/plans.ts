import { money, type Money } from "../payments/types.js";

import type { PaymentProvider as ProviderName, Platform, PlanTier } from "../domain/enums.js";

/**
 * Декларация тарифов и лимитов (TASK 9.2). Provider-agnostic: цены/лимиты описаны здесь,
 * маппинг план↔price конкретного провайдера вынесен в конфиг (resolveProviderPriceId).
 */

export const PLAN_IDS = ["starter", "pro", "studio", "team", "agency", "enterprise"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Метрики, по которым считаются лимиты (зеркалят usage-метрики TASK 9.5). */
export const LIMIT_METRICS = [
  "accounts",
  "renders",
  "videoMinutes",
  "seats",
  "aiGenerations",
  "posts",
] as const;
export type LimitMetric = (typeof LIMIT_METRICS)[number];

/** Лимит: число за период или null = безлимит. */
export type PlanLimits = Record<LimitMetric, number | null>;

export interface Plan {
  id: PlanId;
  name: string;
  tier: PlanTier;
  /** Базовая цена (фиат, за месяц). Крипто-эквивалент опционален (курс — в драйвере). */
  price: Money;
  cryptoPrice?: Money;
  limits: PlanLimits;
  features: {
    /** Водяной знак на выходном видео (связь с TASK 6.7). */
    watermark: boolean;
    /** Доступные платформы публикации. */
    platforms: Platform[];
  };
}

const ALL_PLATFORMS: Platform[] = ["instagram", "tiktok", "reddit", "threads", "youtube", "x"];

/** Реестр планов: B2C (Starter/Pro/Studio) и B2B (Team/Agency/Enterprise). */
export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    tier: "b2c",
    price: money("0", "USD", "fiat"),
    limits: { accounts: 2, renders: 30, videoMinutes: 30, seats: 1, aiGenerations: 50, posts: 60 },
    features: { watermark: true, platforms: ["instagram", "tiktok", "youtube"] },
  },
  pro: {
    id: "pro",
    name: "Pro",
    tier: "b2c",
    price: money("19.99", "USD", "fiat"),
    limits: {
      accounts: 10,
      renders: 300,
      videoMinutes: 300,
      seats: 1,
      aiGenerations: 500,
      posts: 600,
    },
    features: { watermark: false, platforms: ALL_PLATFORMS },
  },
  studio: {
    id: "studio",
    name: "Studio",
    tier: "b2c",
    price: money("49.99", "USD", "fiat"),
    limits: {
      accounts: 30,
      renders: 1000,
      videoMinutes: 1200,
      seats: 3,
      aiGenerations: 2000,
      posts: 2000,
    },
    features: { watermark: false, platforms: ALL_PLATFORMS },
  },
  team: {
    id: "team",
    name: "Team",
    tier: "b2b",
    price: money("99.00", "USD", "fiat"),
    limits: {
      accounts: 50,
      renders: 3000,
      videoMinutes: 3000,
      seats: 5,
      aiGenerations: 6000,
      posts: 6000,
    },
    features: { watermark: false, platforms: ALL_PLATFORMS },
  },
  agency: {
    id: "agency",
    name: "Agency",
    tier: "b2b",
    price: money("299.00", "USD", "fiat"),
    limits: {
      accounts: 200,
      renders: 12000,
      videoMinutes: 12000,
      seats: 20,
      aiGenerations: 24000,
      posts: 24000,
    },
    features: { watermark: false, platforms: ALL_PLATFORMS },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    tier: "b2b",
    // Цена индивидуальна; в декларации — 0, фактическая через провайдерский price (маппинг).
    price: money("0", "USD", "fiat"),
    limits: {
      accounts: null,
      renders: null,
      videoMinutes: null,
      seats: null,
      aiGenerations: null,
      posts: null,
    },
    features: { watermark: false, platforms: ALL_PLATFORMS },
  },
};

/** Возвращает план по id (или undefined). */
export function getPlan(id: PlanId): Plan {
  return PLANS[id];
}

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

/** Связь с TASK 6.7: нужен ли водяной знак для плана. */
export function planHasWatermark(id: PlanId): boolean {
  return PLANS[id].features.watermark;
}

// ─────────────── Маппинг план ↔ price id провайдера (из конфига, не из ядра) ───────────────

/** Карта: planId → { provider → priceId }. Заполняется конфигом приложения. */
export type ProviderPriceMap = Partial<Record<PlanId, Partial<Record<ProviderName, string>>>>;

/** Резолвит provider price id из конфиг-карты. undefined, если не сконфигурирован. */
export function resolveProviderPriceId(
  map: ProviderPriceMap,
  planId: PlanId,
  provider: ProviderName,
): string | undefined {
  return map[planId]?.[provider];
}
