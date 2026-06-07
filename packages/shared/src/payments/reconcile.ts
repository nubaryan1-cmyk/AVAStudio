import type { PaymentProviderRegistry } from "./registry.js";
import type { SubscriptionStatus, PaymentProvider as ProviderName } from "../domain/enums.js";
import type { OrgId } from "../domain/ids.js";

/**
 * Ежедневная сверка подписок (TASK 19.3): статус в нашей БД vs у провайдера.
 * Чистая логика — источники данных через порты; HTTP/cron подключают в инфраструктуре.
 */

export interface LocalSubscriptionRow {
  orgId: OrgId;
  provider: ProviderName;
  providerSubscriptionId: string;
  status: SubscriptionStatus;
}

export interface ReconcileMismatch {
  orgId: OrgId;
  provider: ProviderName;
  providerSubscriptionId: string;
  localStatus: SubscriptionStatus;
  providerStatus: SubscriptionStatus | "not_found";
}

export interface ReconcileReport {
  checked: number;
  mismatches: ReconcileMismatch[];
}

/** Порт списка локальных подписок (БД). */
export interface LocalSubscriptionSource {
  listActive(): Promise<LocalSubscriptionRow[]>;
}

/**
 * Сверяет каждую локальную подписку со статусом у провайдера. Возвращает расхождения
 * (для алерта). Ошибка получения у провайдера трактуется как "not_found" — тоже расхождение.
 */
export async function reconcileSubscriptions(
  registry: PaymentProviderRegistry,
  local: LocalSubscriptionSource,
): Promise<ReconcileReport> {
  const rows = await local.listActive();
  const mismatches: ReconcileMismatch[] = [];
  for (const row of rows) {
    let providerStatus: SubscriptionStatus | "not_found";
    try {
      const sub = await registry.get(row.provider).getSubscription(row.providerSubscriptionId);
      providerStatus = sub.status;
    } catch {
      providerStatus = "not_found";
    }
    if (providerStatus !== row.status) {
      mismatches.push({
        orgId: row.orgId,
        provider: row.provider,
        providerSubscriptionId: row.providerSubscriptionId,
        localStatus: row.status,
        providerStatus,
      });
    }
  }
  return { checked: rows.length, mismatches };
}
