import {
  CryptoInvoiceDriver,
  PaymentProviderRegistry,
  StripeCardDriver,
  type NormalizedPaymentEvent,
  type ProcessedEventStore,
  type SubscriptionState,
  type SubscriptionStore,
} from "@avastudio/shared/payments";

/**
 * Серверный singleton платежей (ЭТАП 19). Собирает реестр драйверов из env (Doppler):
 * карты (Stripe) + крипто. Phase-1 stores — in-memory (Phase-2 = Postgres payment_events
 * + subscriptions). Ключи берём из process.env (Doppler инжектит); прямой доступ помечен.
 */

interface PaymentsState {
  registry: PaymentProviderRegistry;
  processed: ProcessedEventStore;
  subscriptions: SubscriptionStore;
  subStore: Map<string, SubscriptionState>;
}

function buildRegistry(): PaymentProviderRegistry {
  /* eslint-disable no-process-env */
  const stripeSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_dev_insecure";
  const cryptoSecret = process.env.CRYPTO_WEBHOOK_SECRET ?? "ipn_dev_insecure";
  /* eslint-enable no-process-env */
  return new PaymentProviderRegistry()
    .register(new StripeCardDriver({ webhookSecret: stripeSecret }))
    .register(new CryptoInvoiceDriver({ ipnSecret: cryptoSecret }));
}

export function getPayments(): PaymentsState {
  const g = globalThis as unknown as { __avsPayments?: PaymentsState };
  if (!g.__avsPayments) {
    const seen = new Set<string>();
    const subStore = new Map<string, SubscriptionState>();
    const processed: ProcessedEventStore = {
      markProcessed: (id) => {
        if (seen.has(id)) return Promise.resolve(false);
        seen.add(id);
        return Promise.resolve(true);
      },
    };
    const subscriptions: SubscriptionStore = {
      apply: (event: NormalizedPaymentEvent) => {
        if (!event.orgId) return Promise.resolve(undefined);
        const state: SubscriptionState = {
          orgId: event.orgId,
          provider: event.provider,
          ...(event.providerSubscriptionId ? { providerSubscriptionId: event.providerSubscriptionId } : {}),
          ...(event.planId ? { planId: event.planId } : {}),
          status: event.status ?? "active",
          updatedAt: event.occurredAt,
        };
        subStore.set(event.orgId, state);
        return Promise.resolve(state);
      },
    };
    g.__avsPayments = { registry: buildRegistry(), processed, subscriptions, subStore };
  }
  return g.__avsPayments;
}
