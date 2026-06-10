"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@avastudio/ui";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Панель управления облачным телефоном DuoPlus прямо с сайта (TASK 22.1 / Трек A):
 * список телефонов, настройка прокси, вкл/выкл, живой экран (ADB-скриншоты), Прогрев/Заливка.
 */
interface Phone {
  id: string;
  name: string;
  status: number;
  os?: string;
  area?: string;
  ip?: string;
}

const STATUS_LABEL: Record<number, string> = {
  0: "Не сконфигурирован",
  1: "Включён",
  2: "Выключен",
  3: "Истёк",
  4: "Просрочено продление",
  10: "Включается…",
  11: "Конфигурируется…",
  12: "Ошибка конфигурации",
};

export default function DevicePanelPage(): JSX.Element {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [frameSrc, setFrameSrc] = useState<string>("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // прокси
  const [protocol, setProtocol] = useState("socks5");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("");
  const [puser, setPuser] = useState("");
  const [ppass, setPpass] = useState("");

  // каталог приложений DuoPlus
  const [apps, setApps] = useState<{ id: string; name: string; pkg: string }[]>([]);
  const [appId, setAppId] = useState<string>("");

  const phone = phones.find((p) => p.id === selected);

  const loadPhones = useCallback(async () => {
    try {
      const r = await fetch("/api/device/list");
      const j = (await r.json()) as { ok: boolean; phones?: Phone[]; error?: string };
      if (!j.ok) {
        setMsg(`Список: ${j.error ?? "ошибка"}`);
        return;
      }
      setPhones(j.phones ?? []);
      setSelected((s) => s || j.phones?.[0]?.id || "");
    } catch (e) {
      setMsg(`Список: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  useEffect(() => {
    void loadPhones();
  }, [loadPhones]);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/device/apps");
        const j = (await r.json()) as { ok: boolean; apps?: { id: string; name: string; pkg: string }[] };
        if (j.ok) setApps(j.apps ?? []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  // поток кадров экрана
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (screenOn && selected) {
      const tick = (): void => setFrameSrc(`/api/device/frame?id=${encodeURIComponent(selected)}&t=${Date.now()}`);
      tick();
      timer.current = setInterval(tick, 2000);
    }
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [screenOn, selected]);

  async function post(path: string, body: Record<string, unknown>, okMsg: string): Promise<void> {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = (await r.json()) as { ok: boolean; error?: string };
      setMsg(j.ok ? okMsg : `Ошибка: ${j.error ?? "неизвестно"}`);
      if (j.ok) void loadPhones();
    } catch (e) {
      setMsg(`Ошибка: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Облачные телефоны (DuoPlus)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {phones.length === 0 && <p className="text-sm text-muted-foreground">Телефоны не найдены.</p>}
            {phones.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm ${
                  p.id === selected ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                <span>
                  <b>{p.name}</b> <span className="text-muted-foreground">· {p.os ?? ""} · {p.area ?? ""}</span>
                </span>
                <Badge variant={p.status === 1 ? "default" : "secondary"}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
              </button>
            ))}
            <Button variant="outline" size="sm" onClick={() => void loadPhones()}>
              Обновить список
            </Button>
          </CardContent>
        </Card>

        {phone && (
          <Card>
            <CardHeader>
              <CardTitle>Прокси для {phone.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Протокол</Label>
                  <select
                    className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value)}
                  >
                    <option value="socks5">socks5</option>
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">DuoPlus поддерживает только SOCKS5.</p>
                </div>
                <div>
                  <Label>Хост</Label>
                  <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="1.2.3.4" />
                </div>
                <div>
                  <Label>Порт</Label>
                  <Input value={port} onChange={(e) => setPort(e.target.value)} placeholder="1080" />
                </div>
                <div>
                  <Label>Логин (опц.)</Label>
                  <Input value={puser} onChange={(e) => setPuser(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Пароль (опц.)</Label>
                  <Input type="password" value={ppass} onChange={(e) => setPpass(e.target.value)} />
                </div>
              </div>
              <Button
                disabled={busy}
                onClick={() =>
                  void post(
                    "/api/device/proxy",
                    { id: phone.id, protocol, host, port: Number(port), user: puser, password: ppass },
                    "Прокси настроен. Теперь можно включать телефон.",
                  )
                }
              >
                Сохранить прокси
              </Button>
            </CardContent>
          </Card>
        )}

        {phone && (
          <Card>
            <CardHeader>
              <CardTitle>Управление</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button disabled={busy} onClick={() => void post("/api/device/power", { id: phone.id, on: true }, "Включаю…")}>
                Включить
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void post("/api/device/power", { id: phone.id, on: false }, "Выключаю…")}
              >
                Выключить
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => void post("/api/device/install-instagram", { id: phone.id }, "Instagram ставится на телефон…")}>
                Установить Instagram
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void post("/api/device/warmup", { id: phone.id }, "Прогрев поставлен в очередь")}>
                Прогрев
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => void post("/api/device/upload", { id: phone.id }, "Заливка поставлена в очередь")}>
                Заливка
              </Button>
            </CardContent>
          </Card>
        )}

        {phone && (
          <Card>
            <CardHeader>
              <CardTitle>Приложения (каталог DuoPlus)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <Label>Приложение</Label>
                <select
                  value={appId}
                  onChange={(e) => setAppId(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                >
                  <option value="">— выбери приложение —</option>
                  {apps.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <Button
                disabled={busy || !appId}
                onClick={() => void post("/api/device/install", { id: phone.id, appId }, "Приложение ставится на телефон…")}
              >
                Установить
              </Button>
            </CardContent>
          </Card>
        )}

        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </div>

      <div className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>Экран телефона</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button size="sm" variant={screenOn ? "outline" : "default"} disabled={!selected} onClick={() => setScreenOn((v) => !v)}>
              {screenOn ? "Остановить экран" : "Показать экран"}
            </Button>
            <div className="aspect-[9/19] w-full overflow-hidden rounded-lg border bg-black">
              {screenOn && frameSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={frameSrc} alt="экран телефона" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  Экран выключен
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Кадры через ADB (~2с). Нужны включённый телефон и ADB.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
