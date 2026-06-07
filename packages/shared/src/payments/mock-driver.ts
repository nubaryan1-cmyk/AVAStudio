import type {
  CheckoutOptions,
  CheckoutOrgRef,
  CheckoutPlanRef,
  CheckoutSession,
  NormalizedPaymentEvent,
  PaymentProvider,
  PortalSession,
  ProviderCapabilities,
  ProviderSubscription,
} from "./types.js";
import type { OrgId } from "../domain/ids.js";


/**
 * Mock-драйвер для тестов абстракции (TASK 9.1). Детерминированный, без сети.
 * Реализует тот же интерфейс PaymentProvider, что и реальные драйверы.
 */
export interface MockDriverOptions {
  /** Подпись, которую считаем валидной в parseWebhook. */
  webhookSecret?: string;
}

export class MockPaymentDriver implements PaymentProvider {
  readonly name = "stripe" as const; // имя из реестра PAYMENT_PROVIDERS (для тестов)
  readonly capabilities: ProviderCapabilities = { recurring: true, portal: true, refunds: true };

  private seq = 0;
  private readonly secret: string;

  constructor(options: MockDriverOptions = {}) {
    this.secret = options.webhookSecret ?? "mock_secret";
  }

  createCheckout(
    plan: CheckoutPlanRef,
    org: CheckoutOrgRef,
    opts?: CheckoutOptions,
  ): Promise<CheckoutSession> {
    this.seq += 1;
    const id = `mock_cs_${this.seq}`;
    const session: CheckoutSession = {
      id,
      provider: this.name,
      url: `https://mock.pay/checkout/${id}?plan=${plan.planId}&org=${org.id}`,
      amount: plan.amount,
    };
    if (opts?.successUrl) session.url += `&success=${encodeURIComponent(opts.successUrl)}`;
    return Promise.resolve(session);
  }

  getSubscription(id: string): Promise<ProviderSubscription> {
    return Promise.resolve({
      id,
      status: "active",
      planId: "plan_mock",
      cancelAtPeriodEnd: false,
    });
  }

  cancelSubscription(id: string): Promise<ProviderSubscription> {
    return Promise.resolve({
      id,
      status: "canceled",
      planId: "plan_mock",
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
    return Promise.resolve({ url: `https://mock.pay/portal/${customerId}` });
  }

  /**
   * Парсит payload вида JSON {id,type,planId,orgId,...}. Подпись — простое равенство секрету
   * (в реальных драйверах — HMAC/constructEvent). Бросает при неверной подписи.
   */
  parseWebhook(payload: string, signature: string): Promise<NormalizedPaymentEvent> {
    if (signature !== this.secret) {
      return Promise.reject(new Error("mock: invalid webhook signature"));
    }
    const data = JSON.parse(payload) as {
      id: string;
      type: NormalizedPaymentEvent["type"];
      planId?: string;
      orgId?: string;
      providerSubscriptionId?: string;
    };
    const event: NormalizedPaymentEvent = {
      id: data.id,
      provider: this.name,
      type: data.type,
      occurredAt: new Date(0),
      raw: data,
    };
    if (data.planId) event.planId = data.planId;
    if (data.orgId) event.orgId = data.orgId as OrgId;
    if (data.providerSubscriptionId) event.providerSubscriptionId = data.providerSubscriptionId;
    return Promise.resolve(event);
  }
}
