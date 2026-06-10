"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@avastudio/ui";
import { useCallback, useEffect, useState } from "react";

interface Phone {
  id: string;
  name: string;
  status: number;
  os?: string;
  area?: string;
}

const STATUS: Record<number, string> = {
  0: "Не сконфигурирован",
  1: "Включён",
  2: "Выключен",
  10: "Включается…",
  11: "Конфигурируется…",
  12: "Ошибка",
};

/** «Прогрев» — выбор облачных телефонов и запуск человекоподобного прогрева Instagram через очередь. */
export default function WarmupPage(): JSX.Element {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [rounds, setRounds] = useState(8);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async (): Promise<void> => {
    try {
      const r = await fetch("/api/device/list");
      const j = (await r.json()) as { ok: boolean; phones?: Phone[] };
      setPhones(j.phones ?? []);
    } catch {
      setMsg("Не удалось загрузить телефоны");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(id: string): void {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function start(): Promise<void> {
    if (selected.length === 0) {
      setMsg("Выберите хотя бы один телефон");
      return;
    }
    setBusy(true);
    setMsg("");
    let ok = 0;
    const errors: string[] = [];
    for (const id of selected) {
      try {
        const r = await fetch("/api/device/warmup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, rounds }),
        });
        const j = (await r.json()) as { ok: boolean; error?: string };
        if (j.ok) ok += 1;
        else errors.push(`${id}: ${j.error ?? "ошибка"}`);
      } catch (e) {
        errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    setBusy(false);
    setMsg(
      errors.length === 0
        ? `Прогрев поставлен в очередь: ${ok} телефон(ов), по ${rounds} раундов`
        : `Запущено: ${ok}. Ошибки: ${errors.join("; ")}`,
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Прогрев</h1>
        <p className="text-muted-foreground">
          Человекоподобный прогрев Instagram на облачных телефонах: открытие ленты, скролл, лайки. Задачи
          выполняет воркер.
        </p>
      </div>

      {/* Фильтр / сводка */}
      <Card>
        <CardHeader>
          <CardTitle>Настройки прогрева</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div>
            <Label htmlFor="rounds">Раундов на телефон</Label>
            <Input
              id="rounds"
              type="number"
              min={1}
              max={50}
              value={rounds}
              onChange={(e) => setRounds(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="mt-1 w-32"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Выбрано телефонов: <b>{selected.length}</b> · всего раундов: <b>{selected.length * rounds}</b>
          </div>
          <Button disabled={busy} onClick={() => void start()}>
            {busy ? "Ставлю в очередь…" : "Запустить прогрев"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Облачные телефоны</CardTitle>
        </CardHeader>
        <CardContent>
          {phones.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Телефоны не найдены. Арендуй и настрой устройство во вкладке «Устройства → Облачный телефон».
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {phones.map((p) => (
                <li key={p.id} className="flex items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(p.id)}
                    onChange={() => toggle(p.id)}
                    className="h-4 w-4"
                  />
                  <span className="flex-1 truncate font-medium">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.os ?? ""} · {p.area ?? ""}</span>
                  <Badge variant="secondary">{STATUS[p.status] ?? "—"}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}
