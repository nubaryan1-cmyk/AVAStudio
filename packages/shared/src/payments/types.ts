import { z } from "zod";

import type { PaymentProvider as ProviderName, SubscriptionStatus } from "../domain/enums.js";
import type { OrgId } from "../domain/ids.js";

/**
 * Provider-agnostic типы платежей (TASK 9.1, ADR-011).
 * Ядро НЕ знает о Stripe/крипто — только об этих нормализованных типах.
 * Драйверы (карты/крипто/будущие) маппят свои события на них.
 */

// ─────────────────────────── Money (фиат + крипто) ───────────────────────────

export const MONEY_KINDS = ["fiat", "crypto"] as const;
export type MoneyKind = (typeof MONEY_KINDS)[number];

/**
 * Денежная сумма. amount — ДЕСЯТИЧНАЯ СТРОКА (не number), чтобы не терять точность
 * на крипте (8+ знаков) и копейках. currency — ISO-4217 ("USD") или тикер ("BTC","USDT").
 */
export interface Money {
  amount: string;
  currency: string;
  kind: MoneyKind;
}

export const moneySchema: z.ZodType<Money> = z.object({
  amount: z.string().regex(/^\d+(\.\d+)?$/, "amount должен быть неотрицательной десятичной строкой"),
  currency: z.string().min(2).max(10),
  kind: z.enum(MONEY_KINDS),
});

/** Конструктор Money с валидацией. */
export function money(amount: string, currency: string, kind: MoneyKind): Money {
  return moneySchema.parse({ amount, currency, kind });
}

// ─────────────────────── Нормализованные события платежей ───────────────────────

export const PAYMENT_EVENT_TYPES = [
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "payment_succeeded",
  "payment_failed",
] as const;
export type PaymentEventType = (typeof PAYMENT_EVENT_TYPES)[number];

/**
 * Единое событие платежа. Карты и крипто после parseWebhook приводятся к ЭТОМУ типу —
 * ядро обрабатывает их одинаково. `id` уникален у провайдера → ключ идемпотентности.
 */
export interface NormalizedPaymentEvent {
  id: string;
  provider: ProviderName;
  type: PaymentEventType;
  occurredAt: Date;
  /** Внешний id подписки у провайдера (если применимо). */
  providerSubscriptionId?: string;
  /** Целевой план (created/updated). */
  planId?: string;
  status?: SubscriptionStatus;
  amount?: Money;
  /** Организация (протаскивается через metadata checkout). */
  orgId?: OrgId;
  /** Сырые данные провайдера для аудита/отладки. */
  raw?: Record<string, unknown>;
}

// ─────────────────────────── Checkout / Subscription ───────────────────────────

export type BillingInterval = "month" | "year" | "one_time";

/** Ссылка на план для checkout. providerPriceId приходит из маппинга (9.2), не из ядра. */
export interface CheckoutPlanRef {
  planId: string;
  providerPriceId: string;
  amount: Money;
  interval?: BillingInterval;
}

/** Ссылка на организацию-плательщика. */
export interface CheckoutOrgRef {
  id: OrgId;
  customerId?: string;
  email?: string;
}

export interface CheckoutOptions {
  successUrl?: string;
  cancelUrl?: string;
  /** Идемпотентность создания checkout у провайдера. */
  idempotencyKey?: string;
  /** Предпочтительная валюта (крипто-тикер). */
  preferredCurrency?: string;
  /** Метаданные (например, orgId) — возвращаются в webhook. */
  metadata?: Record<string, string>;
}

/** Результат createCheckout. Для карт — url редиректа; для крипто — адрес/invoice. */
export interface CheckoutSession {
  id: string;
  provider: ProviderName;
  url: string;
  amount: Money;
  expiresAt?: Date;
  /** Только крипто: адрес кошелька и сеть. */
  cryptoAddress?: string;
  cryptoNetwork?: string;
}

/** Состояние подписки у провайдера (нормализованное). */
export interface ProviderSubscription {
  id: string;
  status: SubscriptionStatus;
  planId: string;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
}

export interface PortalSession {
  url: string;
}

/** Флаги возможностей драйвера — ядро не вызывает неподдерживаемое. */
export interface ProviderCapabilities {
  recurring: boolean;
  portal: boolean;
  refunds: boolean;
}

// ─────────────────────────── Интерфейс провайдера ───────────────────────────

/**
 * Единый интерфейс платёжного провайдера. Драйвер карт и драйвер крипто реализуют ОДИН
 * и тот же контракт → добавить новый способ оплаты = новый драйвер без правки ядра.
 */
export interface PaymentProvider {
  readonly name: ProviderName;
  readonly capabilities: ProviderCapabilities;

  createCheckout(
    plan: CheckoutPlanRef,
    org: CheckoutOrgRef,
    opts?: CheckoutOptions,
  ): Promise<CheckoutSession>;

  getSubscription(id: string): Promise<ProviderSubscription>;
  cancelSubscription(id: string): Promise<ProviderSubscription>;
  changePlan(id: string, newPlan: CheckoutPlanRef): Promise<ProviderSubscription>;

  /** Проверяет подпись и приводит payload к нормализованному событию. */
  parseWebhook(payload: string, signature: string): Promise<NormalizedPaymentEvent>;

  /** Портал самообслуживания (опционально — только если capabilities.portal). */
  createPortalSession?(customerId: string): Promise<PortalSession>;
}
