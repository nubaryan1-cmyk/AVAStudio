import { createHmac, timingSafeEqual } from "node:crypto";

import { asOrgId } from "../../domain/ids.js";
import { ExternalServiceError } from "../../errors/index.js";

import type {
  CheckoutOptions,
  CheckoutOrgRef,
  CheckoutPlanRef,
  CheckoutSession,
  Money,
  NormalizedPaymentEvent,
  PaymentEventType,
  PaymentProvider,
  PortalSession,
  ProviderCapabilities,
  ProviderSubscription,
} from "../types.js";

/**
 * Драйвер карточных платежей (TASK 9.3). Реализует PaymentProvider.
 * STUB/TEST-режим: без реального Stripe SDK и live-ключей (Фаза 1). Логика подписи webhook
 * повторяет схему Stripe (HMAC-SHA256 над `${t}.${payload}`), чтобы в Фазе 2 замена на
 * `stripe.webhooks.constructEvent` была механической. Тот же интерфейс позволяет заменить
 * Stripe на Paddle/LemonSqueezy без правки ядра.
 */

export interface StripeDriverOptions {
  /** Секрет вебхука (test), из env STRIPE_WEBHOOK_SECRET. */
  webhookSecret: string;
  /** База для checkout URL (test). */
  checkoutBaseUrl?: string;
  /** Источник времени (для детерминизма в тестах). */
  now?: () => Date;
  /** Допустимый разброс времени подписи, сек (анти-replay). */
  toleranceSec?: number;
}

/** Маппинг типов событий Stripe → нормализованные (карты ≡ крипто на уровне ядра). */
const STRIPE_EVENT_MAP: Record<string, PaymentEventType> = {
  "checkout.session.completed": "subscription_created",
  "customer.subscription.created": "subscription_created",
  "customer.subscription.updated": "subscription_updated",
  "customer.subscription.deleted": "subscription_cancelled",
  "invoice.payment_succeeded": "payment_succeeded",
  "payment_intent.succeeded": "payment_succeeded",
  "invoice.payment_failed": "payment_failed",
};

interface StripeObject {
  id?: string;
  amount_total?: number;
  amount_paid?: number;
  currency?: string;
  subscription?: string;
  status?: string;
  metadata?: Record<string, string>;
  plan?: { id?: string };
  items?: { data?: Array<{ price?: { id?: string } }> };
}

interface StripeEvent {
  id: string;
  type: string;
  created?: number;
  data: { object: StripeObject };
}

/** Подписывает payload как Stripe (для тестов и обратной совместимости). */
export function signStripePayload(secret: string, payload: string, timestampSec: number): string {
  const signed = `${timestampSec}.${payload}`;
  const v1 = createHmac("sha256", secret).update(signed).digest("hex");
  return `t=${timestampSec},v1=${v1}`;
}

function parseSigHeader(header: string): { t: number; v1: string } | null {
  let t: number | null = null;
  let v1: string | null = null;
  for (const part of header.split(",")) {
    const [k, val] = part.split("=");
    if (k === "t" && val) t = Number(val);
    if (k === "v1" && val) v1 = val;
  }
  if (t === null || Number.isNaN(t) || !v1) return null;
  return { t, v1 };
}

function moneyFromMinor(minor: number | undefined, currency: string | undefined): Money | undefined {
  if (minor === undefined || !currency) return undefined;
  return { amount: (minor / 100).toFixed(2), currency: currency.toUpperCase(), kind: "fiat" };
}

function mapSubStatus(status: string | undefined): ProviderSubscription["status"] {
  switch (status) {
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete":
      return "incomplete";
    default:
      return "active";
  }
}

export class StripeCardDriver implements PaymentProvider {
  readonly name = "stripe" as const;
  readonly capabilities: ProviderCapabilities = { recurring: true, portal: true, refunds: true };

  private readonly secret: string;
  private readonly base: string;
  private readonly now: () => Date;
  private readonly toleranceSec: number;
  private seq = 0;

  constructor(options: StripeDriverOptions) {
    this.secret = options.webhookSecret;
    this.base = options.checkoutBaseUrl ?? "https://checkout.stripe.test";
    this.now = options.now ?? ((): Date => new Date());
    this.toleranceSec = options.toleranceSec ?? 300;
  }

  createCheckout(
    plan: CheckoutPlanRef,
    org: CheckoutOrgRef,
    opts?: CheckoutOptions,
  ): Promise<CheckoutSession> {
    this.seq += 1;
    const id = opts?.idempotencyKey ?? `cs_test_${this.seq}`;
    const params = new URLSearchParams({ price: plan.providerPriceId, org: org.id });
    if (opts?.successUrl) params.set("success_url", opts.successUrl);
    if (opts?.cancelUrl) params.set("cancel_url", opts.cancelUrl);
    return Promise.resolve({
      id,
      provider: this.name,
      url: `${this.base}/c/${id}?${params.toString()}`,
      amount: plan.amount,
    });
  }

  getSubscription(id: string): Promise<ProviderSubscription> {
    return Promise.resolve({ id, status: "active", planId: "unknown", cancelAtPeriodEnd: false });
  }

  cancelSubscription(id: string): Promise<ProviderSubscription> {
    return Promise.resolve({
      id,
      status: "canceled",
      planId: "unknown",
      cancelAtPeriodEnd: true,
    });
  }

  changePlan(id: string, newPlan: CheckoutPlanRef): Promise<ProviderSubscription> {
    return Promise.resolve({
      id,
      status: "active",
      planId: newPlan.planId,
      cancelAtPeriodEnd: false,
    });
  }

  createPortalSession(customerId: string): Promise<PortalSession> {
    return Promise.resolve({ url: `${this.base}/p/${customerId}` });
  }

  /** Проверяет подпись (как Stripe constructEvent) и нормализует событие. */
  parseWebhook(payload: string, signature: string): Promise<NormalizedPaymentEvent> {
    const parsed = parseSigHeader(signature);
    if (!parsed) {
      return Promise.reject(
        new ExternalServiceError({ internalMessage: "stripe: malformed signature header" }),
      );
    }
    const expected = createHmac("sha256", this.secret)
      .update(`${parsed.t}.${payload}`)
      .digest("hex");
    const a = Buffer.from(parsed.v1);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return Promise.reject(
        new ExternalServiceError({ internalMessage: "stripe: signature mismatch" }),
      );
    }
    const nowSec = Math.floor(this.now().getTime() / 1000);
    if (Math.abs(nowSec - parsed.t) > this.toleranceSec) {
      return Promise.reject(
        new ExternalServiceError({ internalMessage: "stripe: signature timestamp out of tolerance" }),
      );
    }

    const event = JSON.parse(payload) as StripeEvent;
    const type = STRIPE_EVENT_MAP[event.type];
    if (!type) {
      return Promise.reject(
        new ExternalServiceError({ internalMessage: `stripe: unmapped event ${event.type}` }),
      );
    }

    const obj = event.data.object;
    const normalized: NormalizedPaymentEvent = {
      id: event.id, // ← ключ идемпотентности (дедуп в webhook-handler, TASK 9.5)
      provider: this.name,
      type,
      occurredAt: new Date((event.created ?? nowSec) * 1000),
      raw: event as unknown as Record<string, unknown>,
    };
    const subId = obj.subscription ?? (type.startsWith("subscription") ? obj.id : undefined);
    if (subId) normalized.providerSubscriptionId = subId;
    const planId = obj.plan?.id ?? obj.items?.data?.[0]?.price?.id;
    if (planId) normalized.planId = planId;
    if (obj.status) normalized.status = mapSubStatus(obj.status);
    const amount = moneyFromMinor(obj.amount_total ?? obj.amount_paid, obj.currency);
    if (amount) normalized.amount = amount;
    const orgId = obj.metadata?.["orgId"];
    if (orgId) normalized.orgId = asOrgId(orgId);
    return Promise.resolve(normalized);
  }
}
