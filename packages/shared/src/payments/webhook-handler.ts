import type { PaymentProviderRegistry } from "./registry.js";
import type { NormalizedPaymentEvent } from "./types.js";
import type { PaymentProvider as ProviderName, SubscriptionStatus } from "../domain/enums.js";
import type { OrgId } from "../domain/ids.js";

/**
 * Единый провайдеро-независимый обработчик webhook (TASK 9.5).
 * payload+provider → драйвер из реестра → parseWebhook → нормализованное событие →
 * обновление подписок. Идемпотентность по normalized event.id (таблица payment_events).
 * HTTP-роут НЕ здесь — это чистая логика (ЭТАП 13/Фаза 2 подключит транспорт).
 */

/** Срез подписки, обновляемый обработчиком (provider-agnostic). */
export interface SubscriptionState {
  orgId: OrgId;
  provider: ProviderName;
  providerSubscriptionId?: string;
  planId?: string;
  status: SubscriptionStatus;
  updatedAt: Date;
}

/**
 * Порт журнала обработанных событий — основа идемпотентности.
 * markProcessed возвращает false, если событие уже было обработано (дубль).
 */
export interface ProcessedEventStore {
  /** Атомарно помечает event.id обработанным. true — впервые, false — дубль. */
  markProcessed(eventId: string): Promise<boolean>;
}

/** Порт хранилища подписок (реальная БД в инфраструктуре, фейк в тестах). */
export interface SubscriptionStore {
  /** Создать/обновить подписку по нормализованному событию. */
  apply(event: NormalizedPaymentEvent): Promise<SubscriptionState | undefined>;
}

export interface WebhookProcessResult {
  /** Нормализованное событие (для логов/тестов). */
  event: NormalizedPaymentEvent;
  /** false — событие уже обрабатывалось (дубль), действий не было. */
  applied: boolean;
  /** Обновлённое состояние подписки (если применимо). */
  subscription?: SubscriptionState;
}

export interface WebhookHandlerDeps {
  registry: PaymentProviderRegistry;
  processed: ProcessedEventStore;
  subscriptions: SubscriptionStore;
}

/**
 * Обрабатывает входящий webhook. Карты и крипто идут одним путём:
 * выбор драйвера по имени → parseWebhook → дедуп по event.id → обновление подписки.
 */
export async function handleWebhook(
  deps: WebhookHandlerDeps,
  provider: ProviderName,
  payload: string,
  signature: string,
): Promise<WebhookProcessResult> {
  const driver = deps.registry.get(provider);
  const event = await driver.parseWebhook(payload, signature);

  const first = await deps.processed.markProcessed(event.id);
  if (!first) {
    return { event, applied: false };
  }

  const subscription = await deps.subscriptions.apply(event);
  return subscription ? { event, applied: true, subscription } : { event, applied: true };
}

/** In-memory журнал обработанных событий (тесты). Идемпотентность по Set. */
export class InMemoryProcessedEventStore implements ProcessedEventStore {
  private readonly seen = new Set<string>();

  markProcessed(eventId: string): Promise<boolean> {
    if (this.seen.has(eventId)) return Promise.resolve(false);
    this.seen.add(eventId);
    return Promise.resolve(true);
  }
}

/** In-memory хранилище подписок (тесты). Ключ — orgId. */
export class InMemorySubscriptionStore implements SubscriptionStore {
  readonly byOrg = new Map<OrgId, SubscriptionState>();

  apply(event: NormalizedPaymentEvent): Promise<SubscriptionState | undefined> {
    if (!event.orgId) return Promise.resolve(undefined);
    const prev = this.byOrg.get(event.orgId);
    const status: SubscriptionStatus =
      event.status ?? (event.type === "subscription_cancelled" ? "canceled" : "active");
    const next: SubscriptionState = {
      orgId: event.orgId,
      provider: event.provider,
      status,
      updatedAt: event.occurredAt,
      ...(event.providerSubscriptionId !== undefined
        ? { providerSubscriptionId: event.providerSubscriptionId }
        : prev?.providerSubscriptionId !== undefined
          ? { providerSubscriptionId: prev.providerSubscriptionId }
          : {}),
      ...(event.planId !== undefined
        ? { planId: event.planId }
        : prev?.planId !== undefined
          ? { planId: prev.planId }
          : {}),
    };
    this.byOrg.set(event.orgId, next);
    return Promise.resolve(next);
  }
}
