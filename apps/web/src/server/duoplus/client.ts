/** Тонкий serverless-клиент DuoPlus Open API (для роутов сайта). Ключ из Doppler/env. */
const BASE = "https://openapi.duoplus.net";

export interface DuoPhone {
  id: string;
  name: string;
  status: number; // 0 не сконфигурирован;1 вкл;2 выкл;3 истёк;4 просрочено;10 включается;11 конфиг.;12 ошибка
  os?: string;
  area?: string;
  ip?: string;
  adb?: string;
}

function apiKey(): string {
  // eslint-disable-next-line no-process-env
  const k = process.env.DUOPLUS_API_KEY;
  if (!k) throw new Error("DUOPLUS_API_KEY не задан");
  return k;
}

export async function duo<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "DuoPlus-API-Key": apiKey(), "Content-Type": "application/json", Lang: "ru" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const env = (await res.json().catch(() => ({}))) as { code?: number; data?: T; message?: string };
  if (!res.ok || env.code !== 200) {
    throw new Error(`duoplus ${path}: code ${env.code ?? res.status} ${env.message ?? ""}`.trim());
  }
  return (env.data ?? ({} as T));
}

export async function listPhones(): Promise<DuoPhone[]> {
  const data = await duo<{ list?: DuoPhone[] }>("/api/v1/cloudPhone/list", { page: 1, pagesize: 100 });
  return (data.list ?? []).filter((d) => typeof d.id === "string");
}

export interface PowerResult {
  success?: string[];
  fail?: string[];
  fail_reason?: Record<string, string> | string[];
}

export async function powerPhone(id: string, on: boolean): Promise<PowerResult> {
  return duo<PowerResult>(`/api/v1/cloudPhone/${on ? "powerOn" : "powerOff"}`, { image_ids: [id] });
}

/** Включить ADB на телефоне (нужно один раз, до любых команд/скриншота). Идемпотентно. */
export async function enableAdb(id: string): Promise<void> {
  await duo("/api/v1/cloudPhone/openAdb", { image_ids: [id] });
}

async function screencapOnce(id: string): Promise<string> {
  const data = await duo<{ success?: boolean; content?: string; message?: string }>(
    "/api/v1/cloudPhone/command",
    { image_id: id, command: "screencap -p /sdcard/_ava.png >/dev/null 2>&1; base64 /sdcard/_ava.png" },
  );
  return (data.content ?? "").replace(/\s+/g, "");
}

/** Скриншот экрана через ADB (screencap + base64). Самовосстановление: если пусто — включаем ADB и пробуем ещё раз. */
export async function screenshot(id: string): Promise<string> {
  let content = await screencapOnce(id);
  if (!content) {
    await enableAdb(id).catch(() => undefined); // ADB мог быть выключен
    await new Promise((r) => setTimeout(r, 1500));
    content = await screencapOnce(id);
  }
  if (!content) throw new Error("пустой кадр (телефон ещё загружается? ADB включается)");
  return content;
}

export interface ProxyConfig {
  protocol: string; // socks5 | http | https
  host: string;
  port: number;
  user?: string;
  password?: string;
}

export async function initProxy(id: string, proxy: ProxyConfig, ipScan = "ip2location"): Promise<void> {
  await duo("/api/v1/cloudPhone/initProxy", {
    images: [{ image_id: id, ip_scan_channel: ipScan, proxy }],
  });
}

export interface DuoApp {
  id: string; // app_id
  name: string;
  pkg: string;
  version_list?: { id: string; name: string }[];
}

/** Каталог платформенных приложений DuoPlus (для установки). */
export async function listApps(): Promise<DuoApp[]> {
  const data = await duo<{ list?: DuoApp[] }>("/api/v1/app/list", { page: 1, pagesize: 100 });
  return data.list ?? [];
}

/** Установить приложение из каталога DuoPlus на телефон. */
export async function installApp(id: string, appId: string, appVersionId?: string): Promise<void> {
  const body: Record<string, unknown> = { image_ids: [id], app_id: appId };
  if (appVersionId) body.app_version_id = appVersionId;
  await duo("/api/v1/app/install", body);
}

/** Найти Instagram в каталоге (по pkg/имени). Возвращает app_id или null. */
export async function findInstagram(): Promise<DuoApp | null> {
  const apps = await listApps();
  return (
    apps.find((a) => a.pkg === "com.instagram.android") ??
    apps.find((a) => /instagram/i.test(a.name)) ??
    null
  );
}
