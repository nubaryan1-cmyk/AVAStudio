import { PLAN_IDS, type PlanId, type ProviderPriceMap } from "./plans.js";

import type { PaymentProvider as ProviderName } from "../domain/enums.js";

/**
 * Сборка карты план↔priceId из конфигурации окружения (TASK 19.1/19.2).
 * Ядро не хардкодит price-id провайдера — реальные id (Stripe live, крипто-планы)
 * приходят из env через Doppler. Конвенция ключей: `STRIPE_PRICE_<PLAN>`, `CRYPTO_PLAN_<PLAN>`.
 */

export interface PriceEnvSource {
  [key: string]: string | undefined;
}

const PROVIDER_PREFIX: Record<Extract<ProviderName, "stripe" | "crypto">, string> = {
  stripe: "STRIPE_PRICE_",
  crypto: "CRYPTO_PLAN_",
};

/** Строит ProviderPriceMap из env. Пустые/отсутствующие значения просто пропускаются. */
export function buildPriceMapFromEnv(env: PriceEnvSource): ProviderPriceMap {
  const map: ProviderPriceMap = {};
  for (const planId of PLAN_IDS) {
    const key = planId.toUpperCase();
    for (const provider of ["stripe", "crypto"] as const) {
      const value = env[`${PROVIDER_PREFIX[provider]}${key}`];
      if (value && value.trim() !== "") {
        (map[planId] ??= {} as Partial<Record<ProviderName, string>>)[provider] = value.trim();
      }
    }
  }
  return map;
}

/** Планы без сконфигурированного price-id у активного провайдера (диагностика конфига). */
export function missingPriceIds(map: ProviderPriceMap, provider: ProviderName): PlanId[] {
  return PLAN_IDS.filter((p) => p !== "starter" && !map[p]?.[provider]);
}
