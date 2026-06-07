import { NotFoundError } from "../errors/index.js";

import type { PaymentProvider } from "./types.js";
import type { PaymentProvider as ProviderName } from "../domain/enums.js";

/**
 * Реестр платёжных драйверов (TASK 9.1). Активный провайдер выбирается из конфига/env
 * на стороне приложения и передаётся сюда по имени — ядро не хардкодит конкретный провайдер.
 */
export class PaymentProviderRegistry {
  private readonly providers = new Map<ProviderName, PaymentProvider>();

  /** Регистрирует драйвер под его именем. Повторная регистрация заменяет. */
  register(provider: PaymentProvider): this {
    this.providers.set(provider.name, provider);
    return this;
  }

  has(name: ProviderName): boolean {
    return this.providers.has(name);
  }

  /** Возвращает драйвер по имени или бросает NotFoundError. */
  get(name: ProviderName): PaymentProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new NotFoundError({
        userMessage: "Платёжный провайдер недоступен",
        internalMessage: `payment provider not registered: ${name}`,
      });
    }
    return provider;
  }

  /** Список зарегистрированных провайдеров. */
  list(): ProviderName[] {
    return [...this.providers.keys()];
  }
}

/**
 * Выбирает активный провайдер. `preferred` приходит из конфигурации приложения
 * (например, env PAYMENT_PROVIDER). Если не задан — берётся первый зарегистрированный.
 */
export function selectActiveProvider(
  registry: PaymentProviderRegistry,
  preferred?: ProviderName,
): PaymentProvider {
  if (preferred) return registry.get(preferred);
  const [first] = registry.list();
  if (!first) {
    throw new NotFoundError({
      userMessage: "Платёжные провайдеры не настроены",
      internalMessage: "no payment providers registered",
    });
  }
  return registry.get(first);
}
