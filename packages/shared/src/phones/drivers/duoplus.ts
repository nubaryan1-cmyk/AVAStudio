/**
 * Реальный драйвер DuoPlus (TASK 22.1). Реализует тот же PhoneProvider, что и mock
 * (ЭТАП 12.2) — PhonePool/бизнес-код не меняется. ВАЖНО: это ОДИН из провайдеров,
 * не привязка (failover на аналог — 22.2). HTTP через внедряемый fetchImpl (тесты без сети);
 * ключ `DuoPlus-API-Key` из Doppler, наружу не логируется.
 *
 * Маппинг эндпоинтов DuoPlus (help.duoplus.net/docs/api-reference):
 *   rentDevice    → POST /cloudphone/buy            (Buy Cloud Phone)
 *   listDevices   → GET  /cloudphone/list           (Cloud Phone List)
 *   getStatus     → GET  /cloudphone/status?id=     (Cloud Phone Status)
 *   installApp    → POST /application/batch-install (Batch Install App)
 *   executeAction → POST /cloudphone/adb            (Execute ADB command) / screenshot
 *   releaseDevice → POST /cloudphone/power-off      (аренда — подписка; полный возврат — на стороне биллinга)
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

export interface DuoPlusConfig {
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE = "https://api.duoplus.net/api";

const CAPS: PhoneProviderCapabilities = { adb: true, screenshot: true, appInstall: true, maxDevices: 200 };

interface DuoListItem {
  id?: string;
  status?: string;
  region?: string;
  androidVersion?: string;
}

function mapState(status: string | undefined): DeviceState {
  switch ((status ?? "").toLowerCase()) {
    case "running":
    case "on":
      return "rented";
    case "idle":
    case "available":
      return "available";
    case "error":
    case "failed":
      return "error";
    default:
      return "offline";
  }
}

/** ADB-команда для нормализованного действия (input tap/swipe/text). */
function adbCommand(action: DeviceAction): string {
  switch (action.kind) {
    case "tap":
      return `input tap ${action.x ?? 0} ${action.y ?? 0}`;
    case "swipe":
      return `input swipe ${action.x ?? 0} ${action.y ?? 0} ${action.x ?? 0} ${(action.y ?? 0) + 300}`;
    case "type":
      return `input text ${JSON.stringify(action.text ?? "")}`;
    case "launch":
      return `monkey -p ${action.appPackage ?? ""} 1`;
    case "screenshot":
      return "screencap -p";
  }
}

export function createDuoPlusDriver(config: DuoPlusConfig = {}): PhoneProvider {
  const base = config.baseUrl ?? DEFAULT_BASE;
  function client(): typeof fetch {
    if (config.apiKey === undefined || config.apiKey === "") {
      throw new Error("duoplus: API-ключ не настроен");
    }
    return config.fetchImpl ?? fetch;
  }
  const headers = (): Record<string, string> => ({
    "DuoPlus-API-Key": config.apiKey ?? "",
    "content-type": "application/json",
  });
  async function call<T>(path: string, init?: RequestInit): Promise<T> {
    const f = client();
    const res = await f(`${base}${path}`, { ...init, headers: headers() });
    if (!res.ok) throw new Error(`duoplus: HTTP ${res.status} on ${path}`);
    return (await res.json()) as T;
  }

  return {
    name: "duoplus",
    capabilities: CAPS,

    async isHealthy(): Promise<boolean> {
      try {
        await call("/cloudphone/list", { method: "GET" });
        return true;
      } catch {
        return false;
      }
    },

    async rentDevice(spec: DeviceSpec): Promise<Device> {
      const data = await call<{ id?: string; region?: string; androidVersion?: string }>("/cloudphone/buy", {
        method: "POST",
        body: JSON.stringify({ region: spec.region, androidVersion: spec.androidVersion, label: spec.label, count: 1 }),
      });
      if (!data.id) throw new Error("duoplus: пустой id при аренде");
      const device: Device = { id: asPhoneId(data.id), provider: "duoplus", state: "rented" };
      const region = data.region ?? spec.region;
      const androidVersion = data.androidVersion ?? spec.androidVersion;
      if (region) device.region = region;
      if (androidVersion) device.androidVersion = androidVersion;
      return device;
    },

    async releaseDevice(deviceId: PhoneId): Promise<void> {
      await call("/cloudphone/power-off", { method: "POST", body: JSON.stringify({ ids: [deviceId] }) });
    },

    async listDevices(): Promise<readonly Device[]> {
      const data = await call<{ list?: DuoListItem[] }>("/cloudphone/list", { method: "GET" });
      return (data.list ?? [])
        .filter((d): d is DuoListItem & { id: string } => typeof d.id === "string")
        .map((d) => {
          const dev: Device = { id: asPhoneId(d.id), provider: "duoplus", state: mapState(d.status) };
          if (d.region) dev.region = d.region;
          if (d.androidVersion) dev.androidVersion = d.androidVersion;
          return dev;
        });
    },

    async installApp(deviceId: PhoneId, apkRef: string): Promise<void> {
      await call("/application/batch-install", {
        method: "POST",
        body: JSON.stringify({ ids: [deviceId], app: apkRef }),
      });
    },

    async executeAction(deviceId: PhoneId, action: DeviceAction): Promise<ActionResult> {
      try {
        const data = await call<{ output?: string; screenshot?: string }>("/cloudphone/adb", {
          method: "POST",
          body: JSON.stringify({ id: deviceId, command: adbCommand(action) }),
        });
        const result: ActionResult = { ok: true };
        if (action.kind === "screenshot" && data.screenshot) result.screenshot = data.screenshot;
        return result;
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async getStatus(deviceId: PhoneId): Promise<DeviceState> {
      const data = await call<{ status?: string }>(`/cloudphone/status?id=${encodeURIComponent(deviceId)}`, {
        method: "GET",
      });
      return mapState(data.status);
    },
  };
}
