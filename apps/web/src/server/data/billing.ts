import {
  getPlan,
  getUsageVsLimit,
  isPlanId,
  LIMIT_METRICS,
  PLANS,
  type LimitMetric,
  type OrgEntitlementContext,
  type PlanId,
  type UsageVsLimit,
} from "@avastudio/shared/billing";
import { asOrgId } from "@avastudio/shared/domain";
import { money, MockPaymentDriver, type CheckoutSession, type Money } from "@avastudio/shared/payments";

import { getAccount } from "./accounts.js";

import type { PaymentMethod } from "../../lib/billing.js";


/**
 * Биллинг-данные (Фаза 1, provider-agnostic).
 * Тарифы/лимиты — из billing-ядра (ЭТАП 9.2). Реальных платежей нет (Фаза 2):
 * карты — через mock-драйвер, крипто — мок-инвойс.
 */

const ORG_ID = asOrgId("org_demo_1");
const CURRENT_PLAN: PlanId = "pro";

const CURRENT_USAGE: OrgEntitlementContext = {
  planId: CURRENT_PLAN,
  usage: { accounts: 7, renders: 240, videoMinutes: 180, seats: 1, aiGenerations: 470, posts: 320 },
};

export interface InvoiceRow {
  id: string;
  date: string;
  planName: string;
  amount: Money;
  status: "paid" | "refunded";
}

const HISTORY: InvoiceRow[] = [
  { id: "inv_3", date: "2026-05-01", planName: "Pro", amount: money("19.99", "USD", "fiat"), status: "paid" },
  { id: "inv_2", date: "2026-04-01", planName: "Pro", amount: money("19.99", "USD", "fiat"), status: "paid" },
  { id: "inv_1", date: "2026-03-01", planName: "Starter", amount: money("0", "USD", "fiat"), status: "paid" },
];

export interface BillingState {
  planId: PlanId;
  planName: string;
  price: Money;
  usage: UsageVsLimit[];
  history: InvoiceRow[];
  availablePlans: Array<{ id: PlanId; name: string; price: Money; cryptoPrice: Money | null }>;
}

export function getBillingState(): BillingState {
  const plan = getPlan(CURRENT_PLAN);
  const usage = LIMIT_METRICS.map((m: LimitMetric) => getUsageVsLimit(CURRENT_USAGE, m));
  return {
    planId: CURRENT_PLAN,
    planName: plan.name,
    price: plan.price,
    usage,
    history: HISTORY,
    availablePlans: Object.values(PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      cryptoPrice: p.cryptoPrice ?? null,
    })),
  };
}

// ─────────────── Promo-коды ───────────────

const PROMO_CODES: Record<string, number> = {
  WELCOME20: 20,
  STUDIO50: 50,
  AVA10: 10,
};

export interface PromoResult {
  valid: boolean;
  discountPercent: number;
  message: string;
}

export function applyPromo(code: string): PromoResult {
  const normalized = code.trim().toUpperCase();
  const discount = PROMO_CODES[normalized];
  if (discount === undefined) {
    return { valid: false, discountPercent: 0, message: "Промокод не найден" };
  }
  return { valid: true, discountPercent: discount, message: `Скидка ${discount}% применена` };
}

// ─────────────── Checkout (карты / крипто) ───────────────

export interface UpgradeCheckout {
  planId: PlanId;
  method: PaymentMethod;
  url: string;
  amount: Money;
  cryptoAddress: string | null;
  cryptoNetwork: string | null;
}

let cryptoSeq = 0;

export async function createUpgradeCheckout(planId: PlanId, method: PaymentMethod): Promise<UpgradeCheckout> {
  if (!isPlanId(planId)) throw new Error("Неизвестный тариф");
  const plan = getPlan(planId);

  if (method === "card") {
    const driver = new MockPaymentDriver();
    const session: CheckoutSession = await driver.createCheckout(
      { planId, providerPriceId: `price_${planId}`, amount: plan.price, interval: "month" },
      { id: ORG_ID, email: "demo@avastudio.local" },
      { successUrl: "/billing?upgraded=1" },
    );
    return {
      planId,
      method,
      url: session.url,
      amount: session.amount,
      cryptoAddress: null,
      cryptoNetwork: null,
    };
  }

  // Крипто: мок-инвойс (реальная сеть/курс — Фаза 2).
  cryptoSeq += 1;
  const amount = plan.cryptoPrice ?? money(plan.price.amount, "USDC", "crypto");
  return {
    planId,
    method,
    url: `https://mock.pay/crypto/${planId}/inv_${cryptoSeq}`,
    amount,
    cryptoAddress: "0xMOCK0000000000000000000000000000000000",
    cryptoNetwork: "polygon",
  };
}

// ─────────────── Self-service диагностика ───────────────

export interface DiagnosisProblem {
  code: string;
  title: string;
  explanation: string;
  steps: string[];
}

export interface DiagnosisResult {
  accountId: string;
  handle: string;
  platform: string;
  status: string;
  healthScore: number;
  healthy: boolean;
  problems: DiagnosisProblem[];
}

const PROBLEM_CATALOG: Record<string, DiagnosisProblem> = {
  checkpoint: {
    code: "checkpoint",
    title: "Аккаунт получил checkpoint",
    explanation:
      "Площадка запросила подтверждение личности/действия. Публикации приостановлены до прохождения проверки.",
    steps: [
      "Откройте аккаунт в приложении площадки с привязанного устройства.",
      "Пройдите проверку (SMS-код / подтверждение входа).",
      "Подождите 24 часа без новых действий, затем возобновите автопостинг.",
    ],
  },
  shadowban: {
    code: "shadowban",
    title: "Признаки снижения охвата (shadowban)",
    explanation:
      "Резко упал охват — возможны временные ограничения из-за частых однотипных действий.",
    steps: [
      "Поставьте аккаунт на паузу на 48–72 часа.",
      "Снизьте частоту публикаций и включите прогрев (warmup).",
      "Разнообразьте контент и подписи к публикациям.",
    ],
  },
  proxy: {
    code: "proxy",
    title: "Не привязан прокси",
    explanation: "Аккаунт работает без выделенного прокси — повышенный риск ограничений.",
    steps: [
      "Перейдите в карточку аккаунта.",
      "Привяжите выделенный прокси из пула.",
      "Убедитесь, что регион прокси совпадает с регионом аккаунта.",
    ],
  },
};

export function diagnoseAccount(id: string): DiagnosisResult | null {
  const acc = getAccount(id);
  if (!acc) return null;
  const problems: DiagnosisProblem[] = [];
  if (acc.status === "checkpoint") problems.push(PROBLEM_CATALOG.checkpoint!);
  if (acc.healthScore < 50) problems.push(PROBLEM_CATALOG.shadowban!);
  if (acc.proxyId === null) problems.push(PROBLEM_CATALOG.proxy!);
  return {
    accountId: acc.id,
    handle: acc.handle,
    platform: acc.platform,
    status: acc.status,
    healthScore: acc.healthScore,
    healthy: problems.length === 0,
    problems,
  };
}
