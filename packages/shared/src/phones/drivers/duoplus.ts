/**
 * Реальный драйвер DuoPlus (TASK 22.1). Реализует PhoneProvider (интерфейс из ЭТАП 12.2),
 * бизнес-код/PhonePool не меняется. Один из провайдеров, не привязка (failover — 22.2).
 *
 * API (help.duoplus.net/docs/api-reference, проверено на боевом ключе):
 *   Домен:   https://openapi.duoplus.net
 *   Метод:   POST на всех эндпоинтах, тело — JSON
 *   Хедеры:  DuoPlus-API-Key (из Doppler), Content-Type: application/json, Lang: en
 *   Конверт ответа: { code:number (200 ok), data:object, message:string }
 *
 * Маппинг эндпоинтов:
 *   listDevices   → POST /api/v1/cloudPhone/list        (Cloud Phone List, status: int)
 *   getStatus     → берётся из listDevices (статус есть в списке)
 *   executeAction → POST /api/v1/cloudPhone/command     (Execute ADB command; команда без префикса "adb shell")
 *   installApp    → POST /api/v1/application/batchInstall
 *   rentDevice    → POST /api/v1/cloudPhone/buy         (Buy Cloud Phone — платно!)
 *   releaseDevice → POST /api/v1/cloudPhone/powerOff    (выключение; полный возврат — биллинг DuoPlus)
 *   powerOn       → POST /api/v1/cloudPhone/powerOn
 *
 * Статусы DuoPlus (int): 0 не сконфигурирован; 1 включён; 2 выключен; 3 истёк;
 *   4 просрочено продление; 10 включается; 11 конфигурируется; 12 ошибка конфигурации.
 *
 * Скриншот экрана получаем через ADB: `screencap -p /sdcard/_ava.png; base64 /sdcard/_ava.png`
 * — base64 приходит в data.content; декодируется в PNG для live-просмотра.
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
  lang?: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE = "https://openapi.duoplus.net";

const CAPS: PhoneProviderCapabilities = { adb: true, screenshot: true, appInstall: true, maxDevices: 10000 };

interface DuoEnvelope<T> {
  code?: number;
  data?: T;
  message?: string;
}

interface DuoListItem {
  id?: string;
  name?: string;
  status?: number;
  os?: string;
  area?: string;
  ip?: string;
  adb?: string;
}

/** Числовой статус DuoPlus → доменное состояние устройства. */
function mapState(status: number | undefined): DeviceState {
  switch (status) {
    case 1: // Powered on
    case 10: // Powering on
      return "rented";
    case 2: // Powered off — арендован, но выключен → доступен к запуску
      return "available";
    case 12: // Configuration failed
      return "error";
    // 0 не сконфигурирован, 3 истёк, 4 просрочено, 11 конфигурируется
    default:
      return "offline";
  }
}

/** ADB shell-команда для нормализованного действия (без префикса "adb shell"). */
function adbCommand(action: DeviceAction): string {
  switch (action.kind) {
    case "tap":
      return `input tap ${action.x ?? 0} ${action.y ?? 0}`;
    case "swipe": {
      const x = action.x ?? 0;
      const y = action.y ?? 0;
      // Интерфейс DeviceAction несёт только x/y; вертикальный свайп фикс-дельтой (≈скролл ленты).
      return `input swipe ${x} ${y} ${x} ${y + 300} 300`;
    }
    case "type":
      // Пробелы в input text экранируем как %s.
      return `input text ${JSON.stringify((action.text ?? "").replace(/ /g, "%s"))}`;
    case "launch":
      return `monkey -p ${action.appPackage ?? ""} -c android.intent.category.LAUNCHER 1`;
    case "screenshot":
      return "screencap -p /sdcard/_ava.png >/dev/null 2>&1; base64 /sdcard/_ava.png";
  }
}

export function createDuoPlusDriver(config: DuoPlusConfig = {}): PhoneProvider {
  const base = config.baseUrl ?? DEFAULT_BASE;
  const lang = config.lang ?? "en";

  function ensureKey(): string {
    if (config.apiKey === undefined || config.apiKey === "") {
      throw new Error("duoplus: API-ключ не настроен");
    }
    return config.apiKey;
  }

  /** POST на DuoPlus Open API. Кидает ошибку при HTTP!=ok или code!=200. */
  async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const key = ensureKey();
    const f = config.fetchImpl ?? fetch;
    const res = await f(`${base}${path}`, {
      method: "POST",
      headers: {
        "DuoPlus-API-Key": key,
        "Content-Type": "application/json",
        Lang: lang,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`duoplus: HTTP ${res.status} on ${path}`);
    const env = (await res.json()) as DuoEnvelope<T>;
    if (env.code !== 200) {
      throw new Error(`duoplus: code ${env.code ?? "?"} on ${path}: ${env.message ?? ""}`);
    }
    return (env.data ?? ({} as T));
  }

  async function fetchList(): Promise<readonly DuoListItem[]> {
    const data = await call<{ list?: DuoListItem[] }>("/api/v1/cloudPhone/list", { page: 1, pagesize: 100 });
    return data.list ?? [];
  }

  return {
    name: "duoplus",
    capabilities: CAPS,

    async isHealthy(): Promise<boolean> {
      try {
        await fetchList();
        return true;
      } catch {
        return false;
      }
    },

    async rentDevice(spec: DeviceSpec): Promise<Device> {
      // Buy Cloud Phone — платная операция. region/androidVersion — необязательны.
      const data = await call<{ ids?: string[]; id?: string }>("/api/v1/cloudPhone/buy", {
        region: spec.region,
        androidVersion: spec.androidVersion,
        name: spec.label,
        count: 1,
      });
      const id = data.id ?? data.ids?.[0];
      if (!id) throw new Error("duoplus: пустой id при покупке");
      const device: Device = { id: asPhoneId(id), provider: "duoplus", state: "rented" };
      if (spec.region) device.region = spec.region;
      if (spec.androidVersion) device.androidVersion = spec.androidVersion;
      return device;
    },

    async releaseDevice(deviceId: PhoneId): Promise<void> {
      await call("/api/v1/cloudPhone/powerOff", { image_ids: [deviceId] });
    },

    async listDevices(): Promise<readonly Device[]> {
      const list = await fetchList();
      return list
        .filter((d): d is DuoListItem & { id: string } => typeof d.id === "string")
        .map((d) => {
          const dev: Device = { id: asPhoneId(d.id), provider: "duoplus", state: mapState(d.status) };
          if (d.area) dev.region = d.area;
          if (d.os) dev.androidVersion = d.os;
          return dev;
        });
    },

    async installApp(deviceId: PhoneId, apkRef: string): Promise<void> {
      // apkRef — id приложения из List of Platform/Team App.
      await call("/api/v1/application/batchInstall", { image_ids: [deviceId], app_id: apkRef });
    },

    async executeAction(deviceId: PhoneId, action: DeviceAction): Promise<ActionResult> {
      try {
        const data = await call<{ success?: boolean; content?: string; message?: string }>(
          "/api/v1/cloudPhone/command",
          { image_id: deviceId, command: adbCommand(action) },
        );
        if (data.success === false) {
          return { ok: false, error: data.message ?? "duoplus: команда не выполнена" };
        }
        const result: ActionResult = { ok: true };
        if (action.kind === "screenshot" && data.content) {
          result.screenshot = data.content.replace(/\s+/g, ""); // base64 PNG
        }
        return result;
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async getStatus(deviceId: PhoneId): Promise<DeviceState> {
      const list = await fetchList();
      const found = list.find((d) => d.id === deviceId);
      return mapState(found?.status);
    },
  };
}
