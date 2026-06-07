/**
 * Оркестратор PhonePool (TASK 12.2). Поверх упорядоченного списка провайдеров:
 * - failover: аренда идёт по первому здоровому провайдеру; если он недоступен/упал —
 *   переход к следующему. Не привязаны к DuoPlus.
 * - пулинг: освобождённые устройства не уничтожаются сразу, а кэшируются и
 *   переиспользуются (re-use) для того же label, экономя время и снижая «новизну».
 */
import type { Device, DeviceSpec, PhoneProvider } from "./types.js";
import type { PhoneId } from "../domain/ids.js";

export interface PhonePoolOptions {
  /** Переиспользовать освобождённые устройства того же label. */
  reuse?: boolean;
}

interface LeasedRef {
  provider: PhoneProvider;
  device: Device;
  label: string | undefined;
}

/** Результат аренды через пул. */
export interface PhoneLease {
  device: Device;
  /** Имя провайдера, который реально выдал устройство (для диагностики failover). */
  provider: string;
}

export class PhonePool {
  private readonly providers: readonly PhoneProvider[];
  private readonly reuse: boolean;
  private readonly leased = new Map<string, LeasedRef>();
  /** Кэш освобождённых устройств для re-use, ключ = label. */
  private readonly idle = new Map<string, LeasedRef>();

  constructor(providers: readonly PhoneProvider[], options: PhonePoolOptions = {}) {
    if (providers.length === 0) {
      throw new RangeError("PhonePool: нужен минимум один провайдер");
    }
    this.providers = providers;
    this.reuse = options.reuse ?? true;
  }

  /**
   * Арендует устройство. Сначала пробует re-use из idle по label; иначе перебирает
   * провайдеров по порядку (failover A→B) до первого, который здоров и выдал устройство.
   * @throws если все провайдеры недоступны/исчерпаны.
   */
  async acquire(spec: DeviceSpec = {}): Promise<PhoneLease> {
    const label = spec.label;
    if (this.reuse && label !== undefined) {
      const cached = this.idle.get(label);
      if (cached !== undefined) {
        this.idle.delete(label);
        this.leased.set(cached.device.id, cached);
        return { device: cached.device, provider: cached.provider.name };
      }
    }
    const errors: string[] = [];
    for (const provider of this.providers) {
      try {
        if (!(await provider.isHealthy())) {
          errors.push(`${provider.name}: unhealthy`);
          continue;
        }
        const device = await provider.rentDevice(spec);
        const ref: LeasedRef = { provider, device, label };
        this.leased.set(device.id, ref);
        return { device, provider: provider.name };
      } catch (err) {
        errors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    throw new Error(`PhonePool: нет доступных провайдеров (${errors.join("; ")})`);
  }

  /**
   * Освобождает устройство. При reuse и наличии label — кладёт в idle для повторного
   * использования; иначе возвращает провайдеру (releaseDevice).
   */
  async release(deviceId: PhoneId): Promise<void> {
    const ref = this.leased.get(deviceId);
    if (ref === undefined) {
      return;
    }
    this.leased.delete(deviceId);
    if (this.reuse && ref.label !== undefined) {
      this.idle.set(ref.label, ref);
      return;
    }
    await ref.provider.releaseDevice(deviceId);
  }

  /** Кол-во активно арендованных устройств. */
  get activeCount(): number {
    return this.leased.size;
  }

  /** Кол-во устройств в idle-кэше (доступны для re-use). */
  get idleCount(): number {
    return this.idle.size;
  }
}
