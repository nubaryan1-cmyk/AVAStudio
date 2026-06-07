import { z } from "zod";

import type { PhoneId } from "../domain/ids.js";

/**
 * Провайдеро-независимый пул облачных телефонов (ADR-016, TASK 12.2). КРИТИЧНО:
 * не привязываемся к DuoPlus — интерфейс PhoneProvider реализуют ≥2 провайдера
 * (DuoPlus + аналог: GeeLark/MoreLogin), оркестратор PhonePool делает failover A→B
 * и пулинг. Фаза 1 — mock, реальные SDK — Фаза 2 (ЭТАП 22).
 */

/** Спецификация запрашиваемого устройства. */
export const deviceSpecSchema = z.object({
  /** Регион/локация (для гео-таргета и прокси-согласования). */
  region: z.string().optional(),
  androidVersion: z.string().optional(),
  /** Метка аккаунта/назначения (для re-use того же устройства). */
  label: z.string().optional(),
});
export type DeviceSpec = z.infer<typeof deviceSpecSchema>;

export const DEVICE_STATES = ["available", "rented", "offline", "error"] as const;
export type DeviceState = (typeof DEVICE_STATES)[number];

/** Облачное устройство (нормализованное представление). */
export interface Device {
  id: PhoneId;
  provider: string;
  state: DeviceState;
  region?: string;
  androidVersion?: string;
}

/** Действие на устройстве (через ADB/SDK провайдера). */
export const DEVICE_ACTIONS = ["tap", "swipe", "type", "screenshot", "launch"] as const;
export type DeviceActionKind = (typeof DEVICE_ACTIONS)[number];

export interface DeviceAction {
  kind: DeviceActionKind;
  /** Координаты/текст/пакет — зависят от kind. */
  x?: number;
  y?: number;
  text?: string;
  appPackage?: string;
}

export interface ActionResult {
  ok: boolean;
  /** base64-скриншот для kind="screenshot". */
  screenshot?: string;
  error?: string;
}

/** Capabilities провайдера телефонов. */
export interface PhoneProviderCapabilities {
  adb: boolean;
  screenshot: boolean;
  appInstall: boolean;
  maxDevices: number;
}

/**
 * Интерфейс провайдера облачных телефонов. Каждый реальный/mock-драйвер реализует
 * его поверх своего SDK (DuoPlus / GeeLark / …).
 */
export interface PhoneProvider {
  readonly name: string;
  readonly capabilities: PhoneProviderCapabilities;
  /** Доступен ли провайдер сейчас (для failover-решения). */
  isHealthy(): Promise<boolean>;
  rentDevice(spec: DeviceSpec): Promise<Device>;
  releaseDevice(deviceId: PhoneId): Promise<void>;
  listDevices(): Promise<readonly Device[]>;
  installApp(deviceId: PhoneId, apkRef: string): Promise<void>;
  executeAction(deviceId: PhoneId, action: DeviceAction): Promise<ActionResult>;
  getStatus(deviceId: PhoneId): Promise<DeviceState>;
}
