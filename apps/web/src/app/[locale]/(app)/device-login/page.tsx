"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@avastudio/ui";
import { useEffect, useRef, useState } from "react";

/**
 * Вкладка «Вход» (Автозалив): вход в аккаунт + запуск прогрева/заливки.
 * Справа — живой экран телефона (только просмотр, тапы заблокированы).
 */
type Status = { active: boolean; stage: string; ts?: string; next_session_at?: string; sessions_done?: number };

const ta =
  "min-h-[72px] w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export default function DeviceLoginPage(): JSX.Element {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [proxy, setProxy] = useState("");
  // прогрев
  const [warmHashtags, setWarmHashtags] = useState("");
  const [warmNote, setWarmNote] = useState("");
  // заливка
  const [upCaption, setUpCaption] = useState("");
  const [upHashtags, setUpHashtags] = useState("");

  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ active: false, stage: "idle" });
  const [hasStarted, setHasStarted] = useState(false);
  const [frameTick, setFrameTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch("/api/device/status", { cache: "no-store" });
        if (r.ok) setStatus((await r.json()) as Status);
      } catch {
        /* ignore */
      }
      setFrameTick((t) => t + 1);
    }, 700);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function call(path: string, payload: Record<string, unknown>, tag: string): Promise<void> {
    setError(null);
    setBusy(tag);
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = (await r.json()) as { ok: boolean; error?: string };
      if (!j.ok) setError(j.error ?? "Не удалось запустить");
      else setHasStarted(true);
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(null);
    }
  }

  const stageLabel: Record<string, string> = {
    idle: "Ожидание",
    starting: "Запуск…",
    opening_login: "Открываю Instagram…",
    cookies: "Согласие cookies…",
    typing_username: "Ввожу логин…",
    typing_password: "Ввожу пароль…",
    submitting: "Вхожу…",
    resume_check: "Проверяю сессию…",
    resumed: "Сессия активна",
    logged_in: "Вход выполнен",
    done: "Готово",
    warmup_scrolling: "Прогрев: листаю ленту…",
    failed: "Ошибка",
    error: "Ошибка",
    resting: "Перерыв между заходами",
  };

  function label(st: Status): string {
    if (st.stage.startsWith("session")) return "Прогрев: заход…";
    if (st.stage === "resting" && st.next_session_at) return `Перерыв — заход в ${st.next_session_at}`;
    return stageLabel[st.stage] ?? st.stage;
  }

  return (
    <div className="glow-panel grid gap-6 rounded-xl border p-4 md:grid-cols-[380px_1fr] md:p-6">
      {/* Левая колонка — действия */}
      <div className="grid gap-6">
        {/* Вход */}
        <Card>
          <CardHeader>
            <CardTitle>Вход в аккаунт</CardTitle>
            <CardDescription>Бот сам зайдёт в аккаунт. Экран справа — только наблюдение.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="login">Логин</Label>
              <Input id="login" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="username" autoComplete="off" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">Пароль</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="proxy">Прокси</Label>
              <Input id="proxy" value={proxy} onChange={(e) => setProxy(e.target.value)} placeholder="ip:port:логин:пароль" autoComplete="off" />
            </div>
            <Button onClick={() => void call("/api/device/login", { login, password, proxy }, "login")} disabled={busy !== null || !login || !password}>
              {busy === "login" ? "Запускаю…" : "Вход"}
            </Button>
          </CardContent>
        </Card>

        {/* Прогрев */}
        <Card>
          <CardHeader>
            <CardTitle>Прогрев</CardTitle>
            <CardDescription>Бот листает ленту и тематику по-человечески. Поля — для тематического прогрева.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="warmHashtags">Хэштеги (тематика прогрева)</Label>
              <textarea id="warmHashtags" className={ta} value={warmHashtags} onChange={(e) => setWarmHashtags(e.target.value)} placeholder="#fitness #travel #food" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="warmNote">Описание / заметка</Label>
              <textarea id="warmNote" className={ta} value={warmNote} onChange={(e) => setWarmNote(e.target.value)} placeholder="ниша аккаунта, интересы…" />
            </div>
            <Button variant="secondary" onClick={() => void call("/api/device/warmup", { login, proxy, hashtags: warmHashtags, note: warmNote }, "warmup")} disabled={busy !== null || !login}>
              {busy === "warmup" ? "Запускаю…" : "Запустить прогрев"}
            </Button>
          </CardContent>
        </Card>

        {/* Заливка */}
        <Card>
          <CardHeader>
            <CardTitle>Заливка Reels</CardTitle>
            <CardDescription>Подпись и хэштеги ниже применяются к рилсам, у которых нет своих.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="upCaption">Подпись по умолчанию</Label>
              <textarea id="upCaption" className={ta} value={upCaption} onChange={(e) => setUpCaption(e.target.value)} placeholder="текст под рилс" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="upHashtags">Хэштеги по умолчанию</Label>
              <Input id="upHashtags" value={upHashtags} onChange={(e) => setUpHashtags(e.target.value)} placeholder="#reels #viral #fyp" />
            </div>
            <Button onClick={() => void call("/api/device/upload", { login, proxy, caption: upCaption, hashtags: upHashtags }, "upload")} disabled={busy !== null || !login}>
              {busy === "upload" ? "Запускаю…" : "Запустить заливку"}
            </Button>
          </CardContent>
        </Card>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>

      {/* Правая колонка — живой экран (шире) */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Экран телефона</CardTitle>
          <Badge variant={status.active ? "default" : "secondary"}>{label(status)}</Badge>
        </CardHeader>
        <CardContent>
          <div className="relative mx-auto aspect-[390/844] w-full max-w-[440px] overflow-hidden rounded-2xl border bg-black" style={{ maxHeight: "78vh" }}>
            <div className="absolute inset-0 z-10" aria-hidden />
            {status.active || hasStarted ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/device/frame?t=${frameTick}`} alt="phone screen" className="absolute inset-0 h-full w-full select-none object-contain" draggable={false} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-muted-foreground">
                Экран появится после запуска
              </div>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">Только просмотр — взаимодействие с экраном заблокировано.</p>
        </CardContent>
      </Card>
    </div>
  );
}
