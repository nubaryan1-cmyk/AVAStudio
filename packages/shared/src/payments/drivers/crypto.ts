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
  PaymentProvider,
  ProviderCapabilities,
  ProviderSubscription,
} from "../types.js";

/**
 * Драйвер крипто-платежей (TASK 9.4, stub). Реализует ТОТ ЖЕ интерфейс PaymentProvider,
 * что и карты. Выбран профиль NOWPayments (широкий выбор монет) — см. ADR-012.
 * Фаза 1: без реальных ключей/сети. Подпись IPN — HMAC-SHA512 над payload (как у NOWPayments).
 *
 * Особенность крипто: НЕТ нативного recurring. Подписка моделируется как периодические
 * invoice; драйвер отдаёт хелперы для renewal-напоминаний (nextRenewalDate/isRenewalDue).
 */

/** Курс фиат→крипта: (сумма фиата, валюта фиата, тикер крипты) → строковая сумма крипты. */
export type RateProvider = (amountFiat: string, fiatCurrency: string, cryptoCurrency: string) => string;

/** Стаб-курсы (1 единица фиата → X крипты). Детерминированы для тестов/Фазы 1. */
const STUB_RATES: Record<string, number> = {
  BTC: 0.000025, // ~ $40k/BTC
  ETH: 0.0004, // ~ $2.5k/ETH
  USDT: 1, // стейблкоин ≈ 1 USD
  USDC: 1,
};

const NETWORKS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  USDT: "tron",
  USDC: "ethereum",
};

const defaultRate: RateProvider = (amountFiat, _fiat, crypto) => {
  const factor = STUB_RATES[crypto.toUpperCase()] ?? 1;
  return (Number(amountFiat) * factor).toFixed(8);
};

export interface CryptoDriverOptions {
  /** Секрет IPN (вебхук), из env CRYPTO_WEBHOOK_SECRET. */
  ipnSecret: string;
  rate?: RateProvider;
  /** Подтверждений сети для payment_succeeded. */
  requiredConfirmations?: number;
  /** База ссылки на invoice. */
  invoiceBaseUrl?: string;
  now?: () => Date;
  /** Длительность периода подписки (дней) для renewal-напоминаний. */
  renewalIntervalDays?: number;
  /** TTL инвойса (минут). */
  invoiceTtlMinutes?: number;
}

interface CryptoIpnPayload {
  payment_id: string;
  payment_status: string;
  pay_amount?: string | number;
  pay_currency?: string;
  confirmations?: number;
  order_id?: string;
  created_at?: string;
}

export class CryptoInvoiceDriver implements PaymentProvider {
  readonly name = "crypto" as const;
  // Нет recurring/portal/refunds — ядро узнаёт это и использует invoice-renewal-поток.
  readonly capabilities: ProviderCapabilities = { recurring: false, portal: false, refunds: false };

  private readonly secret: string;
  private readonly rate: RateProvider;
  private readonly requiredConfirmations: number;
  private readonly base: string;
  private readonly now: () => Date;
  private readonly renewalIntervalDays: number;
  private readonly invoiceTtlMinutes: number;
  private seq = 0;

  constructor(options: CryptoDriverOptions) {
    this.secret = options.ipnSecret;
    this.rate = options.rate ?? defaultRate;
    this.requiredConfirmations = options.requiredConfirmations ?? 3;
    this.base = options.invoiceBaseUrl ?? "https://invoice.crypto.test";
    this.now = options.now ?? ((): Date => new Date());
    this.renewalIntervalDays = options.renewalIntervalDays ?? 30;
    this.invoiceTtlMinutes = options.invoiceTtlMinutes ?? 60;
  }

  createCheckout(
    plan: CheckoutPlanRef,
    org: CheckoutOrgRef,
    opts?: CheckoutOptions,
  ): Promise<CheckoutSession> {
    this.seq += 1;
    const crypto = (opts?.preferredCurrency ?? "BTC").toUpperCase();
    const cryptoAmount = this.rate(plan.amount.amount, plan.amount.currency, crypto);
    const id = opts?.idempotencyKey ?? `inv_${this.seq}`;
    const address = `addr_${crypto.toLowerCase()}_${this.seq}`;
    const amount: Money = { amount: cryptoAmount, currency: crypto, kind: "crypto" };
    const expiresAt = new Date(this.now().getTime() + this.invoiceTtlMinutes * 60_000);
    const session: CheckoutSession = {
      id,
      provider: this.name,
      url: `${this.base}/i/${id}?org=${org.id}&plan=${plan.planId}`,
      amount,
      expiresAt,
      cryptoAddress: address,
      cryptoNetwork: NETWORKS[crypto] ?? "unknown",
    };
    return Promise.resolve(session);
  }

  /** Подписка = периодические invoice. Синтез состояния (фактическое хранится в БД, 9.5). */
  getSubscription(id: string): Promise<ProviderSubscription> {
    return Promise.resolve({
      id,
      status: "active",
      planId: "unknown",
      currentPeriodEnd: this.nextRenewalDate(this.now()),
      cancelAtPeriodEnd: false,
    });
  }

  cancelSubscription(id: string): Promise<ProviderSubscription> {
    return Promise.resolve({ id, status: "canceled", planId: "unknown", cancelAtPeriodEnd: true });
  }

  changePlan(id: string, newPlan: CheckoutPlanRef): Promise<ProviderSubscription> {
    return Promise.resolve({
      id,
      status: "active",
      planId: newPlan.planId,
      currentPeriodEnd: this.nextRenewalDate(this.now()),
      cancelAtPeriodEnd: false,
    });
  }

  /** Дата следующего renewal-invoice (для напоминаний). */
  nextRenewalDate(from: Date): Date {
    return new Date(from.getTime() + this.renewalIntervalDays * 86_400_000);
  }

  /** Пора ли выставлять renewal-invoice. */
  isRenewalDue(currentPeriodEnd: Date, at: Date = this.now()): boolean {
    return at.getTime() >= currentPeriodEnd.getTime();
  }

  /** Проверяет подпись IPN (HMAC-SHA512) и нормализует событие по подтверждениям. */
  parseWebhook(payload: string, signature: string): Promise<NormalizedPaymentEvent> {
    const expected = createHmac("sha512", this.secret).update(payload).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return Promise.reject(
        new ExternalServiceError({ internalMessage: "crypto: IPN signature mismatch" }),
      );
    }

    const data = JSON.parse(payload) as CryptoIpnPayload;
    const status = data.payment_status.toLowerCase();
    const confirmations = data.confirmations ?? 0;
    const succeeded =
      status === "finished" ||
      ((status === "confirmed" || status === "sending") &&
        confirmations >= this.requiredConfirmations);
    const failed = status === "failed" || status === "expired" || status === "refunded";

    if (!succeeded && !failed) {
      // Промежуточный статус (waiting/confirming/partially_paid) — не терминальное событие.
      return Promise.reject(
        new ExternalServiceError({
          internalMessage: `crypto: non-terminal status ${status} (conf=${confirmations})`,
        }),
      );
    }

    const event: NormalizedPaymentEvent = {
      id: data.payment_id, // ключ идемпотентности (дедуп в webhook-handler, 9.5)
      provider: this.name,
      type: succeeded ? "payment_succeeded" : "payment_failed",
      occurredAt: data.created_at ? new Date(data.created_at) : this.now(),
      raw: data as unknown as Record<string, unknown>,
    };
    if (data.pay_amount !== undefined && data.pay_currency) {
      event.amount = {
        amount: String(data.pay_amount),
        currency: data.pay_currency.toUpperCase(),
        kind: "crypto",
      };
    }
    if (data.order_id) event.orgId = asOrgId(data.order_id);
    return Promise.resolve(event);
  }
}

/** Подписывает payload как IPN (для тестов). */
export function signCryptoIpn(secret: string, payload: string): string {
  return createHmac("sha512", secret).update(payload).digest("hex");
}
