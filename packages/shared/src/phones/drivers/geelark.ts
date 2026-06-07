/**
 * Реальный драйвер GeeLark (TASK 22.2) — второй провайдер облачных телефонов,
 * взаимозаменяемый с DuoPlus (тот же PhoneProvider). Обеспечивает failover и отсутствие
 * lock-in: PhonePool переключается A→B без изменения бизнес-кода. HTTP через fetchImpl.
 */
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

export interface GeeLarkConfig {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE = "https://openapi.geelark.com/v1";
const CAPS: PhoneProviderCapabilities = { adb: true, screenshot: true, appInstall: true, maxDevices: 200 };

function mapState(status: string | undefined): DeviceState {
  switch ((status ?? "").toLowerCase()) {
    case "started":
    case "running":
      return "rented";
    case "stopped":
    case "idle":
      return "available";
    case "error":
      return "error";
    default:
      return "offline";
  }
}

export function createGeeLarkDriver(config: GeeLarkConfig = {}): PhoneProvider {
  const base = config.baseUrl ?? DEFAULT_BASE;
  function client(): typeof fetch {
    if (config.apiKey === undefined || config.apiKey === "") {
      throw new Error("geelark: API-ключ не настроен");
    }
    return config.fetchImpl ?? fetch;
  }
  const headers = (): Record<string, string> => ({
    authorization: `Bearer ${config.apiKey ?? ""}`,
    "content-type": "application/json",
  });
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await client()(`${base}${path}`, { ...init, headers: headers() });
    if (!res.ok) throw new Error(`geelark: HTTP ${res.status} on ${path}`);
    return (await res.json()) as T;
  }

  return {
    name: "geelark",
    capabilities: CAPS,
    async isHealthy(): Promise<boolean> {
      try {
        await call("/phone/list", { method: "GET" });
        return true;
      } catch {
        return false;
      }
    },
    async rentDevice(spec: DeviceSpec): Promise<Device> {
      const data = await call<{ id?: string }>("/phone/create", {
        method: "POST",
        body: JSON.stringify({ region: spec.region, androidVersion: spec.androidVersion }),
      });
      if (!data.id) throw new Error("geelark: пустой id при аренде");
      const dev: Device = { id: asPhoneId(data.id), provider: "geelark", state: "rented" };
      if (spec.region) dev.region = spec.region;
      if (spec.androidVersion) dev.androidVersion = spec.androidVersion;
      return dev;
    },
    async releaseDevice(deviceId: PhoneId): Promise<void> {
      await call("/phone/stop", { method: "POST", body: JSON.stringify({ ids: [deviceId] }) });
    },
    async listDevices(): Promise<readonly Device[]> {
      const data = await call<{ items?: Array<{ id?: string; status?: string }> }>("/phone/list", { method: "GET" });
      return (data.items ?? [])
        .filter((d): d is { id: string; status?: string } => typeof d.id === "string")
        .map((d) => ({ id: asPhoneId(d.id), provider: "geelark", state: mapState(d.status) }));
    },
    async installApp(deviceId: PhoneId, apkRef: string): Promise<void> {
      await call("/app/install", { method: "POST", body: JSON.stringify({ id: deviceId, app: apkRef }) });
    },
    async executeAction(deviceId: PhoneId, action: DeviceAction): Promise<ActionResult> {
      try {
        const data = await call<{ screenshot?: string }>("/phone/adb", {
          method: "POST",
          body: JSON.stringify({ id: deviceId, action: action.kind, x: action.x, y: action.y, text: action.text, app: action.appPackage }),
        });
        const result: ActionResult = { ok: true };
        if (action.kind === "screenshot" && data.screenshot) result.screenshot = data.screenshot;
        return result;
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    async getStatus(deviceId: PhoneId): Promise<DeviceState> {
      const data = await call<{ status?: string }>(`/phone/status?id=${encodeURIComponent(deviceId)}`, { method: "GET" });
      return mapState(data.status);
    },
  };
}
