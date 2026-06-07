/**
 * Базовый mock-драйвер PhoneProvider (TASK 12.2). Имитирует облачный телефон-сервис
 * в памяти: аренда/освобождение/действия. Конкретные провайдеры (DuoPlus/аналог)
 * создаются из него с разными именами — для проверки взаимозаменяемости и failover.
 */
import { randomUUID } from "node:crypto";

import { asPhoneId, type PhoneId } from "../../domain/ids.js";

import type {
  ActionResult,
  Device,
  DeviceAction,
  DeviceSpec,
  DeviceState,
  PhoneProvider,
  PhoneProviderCapabilities,
} from "../types.js";

export interface MockPhoneProviderOptions {
  name: string;
  maxDevices?: number;
  /** Провайдер «лежит» — isHealthy=false, аренда бросает (для failover-теста). */
  down?: boolean;
}

const DEFAULT_CAPS: Omit<PhoneProviderCapabilities, "maxDevices"> = {
  adb: true,
  screenshot: true,
  appInstall: true,
};

/** Создаёт mock-провайдер облачных телефонов с in-memory состоянием. */
export function createMockPhoneProvider(options: MockPhoneProviderOptions): PhoneProvider {
  const name = options.name;
  const maxDevices = options.maxDevices ?? 10;
  const devices = new Map<string, Device>();

  function ensureUp(): void {
    if (options.down === true) {
      throw new Error(`${name}: провайдер недоступен`);
    }
  }

  return {
    name,
    capabilities: { ...DEFAULT_CAPS, maxDevices },
    async isHealthy(): Promise<boolean> {
      return options.down !== true;
    },
    async rentDevice(spec: DeviceSpec): Promise<Device> {
      ensureUp();
      if (devices.size >= maxDevices) {
        throw new Error(`${name}: исчерпан лимит устройств (${maxDevices})`);
      }
      const id = asPhoneId(randomUUID());
      const device: Device = {
        id,
        provider: name,
        state: "rented",
        ...(spec.region !== undefined ? { region: spec.region } : {}),
        ...(spec.androidVersion !== undefined ? { androidVersion: spec.androidVersion } : {}),
      };
      devices.set(id, device);
      return device;
    },
    async releaseDevice(deviceId: PhoneId): Promise<void> {
      devices.delete(deviceId);
    },
    async listDevices(): Promise<readonly Device[]> {
      return [...devices.values()];
    },
    async installApp(deviceId: PhoneId): Promise<void> {
      ensureUp();
      if (!devices.has(deviceId)) {
        throw new Error(`${name}: устройство ${deviceId} не арендовано`);
      }
    },
    async executeAction(deviceId: PhoneId, action: DeviceAction): Promise<ActionResult> {
      ensureUp();
      if (!devices.has(deviceId)) {
        return { ok: false, error: `${name}: устройство ${deviceId} не арендовано` };
      }
      if (action.kind === "screenshot") {
        return { ok: true, screenshot: "data:image/png;base64,iVBORw0KGgo=" };
      }
      return { ok: true };
    },
    async getStatus(deviceId: PhoneId): Promise<DeviceState> {
      return devices.get(deviceId)?.state ?? "offline";
    },
  };
}
