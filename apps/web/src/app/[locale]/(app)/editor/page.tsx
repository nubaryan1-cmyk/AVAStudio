"use client";

import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@avastudio/ui";
import { useRef, useState, type ChangeEvent } from "react";

/** Текстовая надпись поверх видео. */
interface TextOverlay {
  id: number;
  text: string;
  position: "top" | "center" | "bottom";
  start: number;
  end: number;
}

const FILTERS = [
  { id: "none", label: "Без фильтра" },
  { id: "vivid", label: "Сочный" },
  { id: "bw", label: "Ч/Б" },
  { id: "vintage", label: "Винтаж" },
  { id: "warm", label: "Тёплый" },
  { id: "cold", label: "Холодный" },
  { id: "blur-bg", label: "Размытый фон" },
] as const;

const TRANSITIONS = [
  { id: "none", label: "Нет" },
  { id: "fade", label: "Затухание" },
  { id: "slide", label: "Сдвиг" },
  { id: "zoom", label: "Зум" },
  { id: "whip", label: "Хлыст" },
] as const;

const PATTERNS = [
  { id: "none", label: "Нет" },
  { id: "grain", label: "Зерно плёнки" },
  { id: "vignette", label: "Виньетка" },
  { id: "light-leak", label: "Засветы" },
  { id: "dust", label: "Пыль" },
] as const;

const fmt = (s: number): string => `${s.toFixed(2)}s`;

export default function EditorPage(): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDur, setVideoDur] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [speedStart, setSpeedStart] = useState(0);
  const [speedEnd, setSpeedEnd] = useState(0);
  const [speed, setSpeed] = useState(2);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDur, setAudioDur] = useState(0);
  const [audioStart, setAudioStart] = useState(0);
  const [audioEnd, setAudioEnd] = useState(0);
  const [volume, setVolume] = useState(15);
  const [keepVoice, setKeepVoice] = useState(true);

  const [filter, setFilter] = useState("none");
  const [transition, setTransition] = useState("none");
  const [pattern, setPattern] = useState("none");
  const [texts, setTexts] = useState<TextOverlay[]>([]);
  const [newText, setNewText] = useState("");

  const [spec, setSpec] = useState<string>("");

  function loadVideo(e: ChangeEvent<HTMLInputElement>): void {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    setVideoUrl(url);
    setTrimStart(0);
    setTrimEnd(0);
    setSpeedStart(0);
    setSpeedEnd(0);
  }

  function loadAudio(e: ChangeEvent<HTMLInputElement>): void {
    const f = e.target.files?.[0];
    if (!f) return;
    setAudioUrl(URL.createObjectURL(f));
    setAudioStart(0);
    setAudioEnd(0);
  }

  const vCur = (): number => videoRef.current?.currentTime ?? 0;
  const aCur = (): number => audioRef.current?.currentTime ?? 0;

  /** Проиграть только выделенный участок видео. */
  function playVideoSelection(): void {
    const v = videoRef.current;
    if (!v) return;
    const end = trimEnd > trimStart ? trimEnd : videoDur;
    v.currentTime = trimStart;
    void v.play();
    const stop = (): void => {
      if (v.currentTime >= end) {
        v.pause();
        v.removeEventListener("timeupdate", stop);
      }
    };
    v.addEventListener("timeupdate", stop);
  }

  /** Прослушать выделенный участок музыки. */
  function playAudioSelection(): void {
    const a = audioRef.current;
    if (!a) return;
    const end = audioEnd > audioStart ? audioEnd : audioDur;
    a.currentTime = audioStart;
    void a.play();
    const stop = (): void => {
      if (a.currentTime >= end) {
        a.pause();
        a.removeEventListener("timeupdate", stop);
      }
    };
    a.addEventListener("timeupdate", stop);
  }

  function addText(): void {
    if (!newText.trim()) return;
    setTexts((t) => [
      ...t,
      { id: Date.now(), text: newText.trim(), position: "bottom", start: trimStart, end: trimEnd || videoDur },
    ]);
    setNewText("");
  }

  function buildSpec(): void {
    const s = {
      video: { trim: { start: trimStart, end: trimEnd || videoDur }, speed: { start: speedStart, end: speedEnd, factor: speed } },
      music: { region: { start: audioStart, end: audioEnd || audioDur }, volume, keepVoice },
      filter,
      transition,
      pattern,
      texts: texts.map((t) => ({ text: t.text, position: t.position, start: t.start, end: t.end })),
    };
    setSpec(JSON.stringify(s, null, 2));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Редактор</h1>
        <p className="text-muted-foreground">
          Монтаж прямо на сайте: обрезка, скорость, музыка, текст, переходы и эффекты — без сторонних программ.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* ЛЕВО: видео-плеер + обрезка */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Видео</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input type="file" accept="video/*" onChange={loadVideo} />
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full rounded-lg border bg-black"
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration;
                    setVideoDur(d);
                    setTrimEnd(d);
                  }}
                />
              ) : (
                <div className="flex h-48 items-center justify-center rounded-lg border text-sm text-muted-foreground">
                  Загрузи видео, чтобы начать монтаж
                </div>
              )}

              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-medium">1. Границы видео (обрезать лишнее)</p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={!videoUrl} onClick={() => setTrimStart(vCur())}>
                    [ Начало: {fmt(trimStart)}
                  </Button>
                  <Button size="sm" variant="outline" disabled={!videoUrl} onClick={() => setTrimEnd(vCur())}>
                    ] Конец: {fmt(trimEnd)}
                  </Button>
                  <Button size="sm" disabled={!videoUrl} onClick={playVideoSelection}>
                    ▶ Играть выделенное
                  </Button>
                </div>
                {videoDur > 0 && (
                  <input
                    type="range"
                    min={0}
                    max={videoDur}
                    step={0.05}
                    value={trimEnd || videoDur}
                    onChange={(e) => setTrimEnd(Number(e.target.value))}
                    className="mt-3 w-full"
                  />
                )}
              </div>

              <div className="rounded-md border p-3">
                <p className="mb-2 text-sm font-medium">2. Ускорение внутри</p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" disabled={!videoUrl} onClick={() => setSpeedStart(vCur())}>
                    [ Старт: {fmt(speedStart)}
                  </Button>
                  <Button size="sm" variant="outline" disabled={!videoUrl} onClick={() => setSpeedEnd(vCur())}>
                    ] Конец: {fmt(speedEnd)}
                  </Button>
                  <Label htmlFor="spd" className="ml-2">Скорость</Label>
                  <Input
                    id="spd"
                    type="number"
                    min={0.5}
                    max={4}
                    step={0.1}
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value) || 1)}
                    className="w-24"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Музыка */}
          <Card>
            <CardHeader>
              <CardTitle>Музыка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input type="file" accept="audio/*" onChange={loadAudio} />
              {audioUrl && (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  controls
                  className="w-full"
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration;
                    setAudioDur(d);
                    setAudioEnd(d);
                  }}
                />
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={!audioUrl} onClick={() => setAudioStart(aCur())}>
                  [ Старт: {fmt(audioStart)}
                </Button>
                <Button size="sm" variant="outline" disabled={!audioUrl} onClick={() => setAudioEnd(aCur())}>
                  ] Конец: {fmt(audioEnd)}
                </Button>
                <Button size="sm" disabled={!audioUrl} onClick={playAudioSelection}>
                  ▶ Прослушать участок
                </Button>
              </div>
              <div>
                <Label>Громкость музыки: {volume}%</Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="mt-1 w-full"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={keepVoice} onChange={(e) => setKeepVoice(e.target.checked)} />
                Оставить оригинальный голос
              </label>
            </CardContent>
          </Card>
        </div>

        {/* ПРАВО: CapCut-функции */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Текст / надписи</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Текст надписи" value={newText} onChange={(e) => setNewText(e.target.value)} />
                <Button onClick={addText}>Добавить</Button>
              </div>
              {texts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Надписей нет.</p>
              ) : (
                <ul className="space-y-2">
                  {texts.map((t) => (
                    <li key={t.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                      <span className="flex-1 truncate">{t.text}</span>
                      <select
                        value={t.position}
                        onChange={(e) =>
                          setTexts((arr) =>
                            arr.map((x) => (x.id === t.id ? { ...x, position: e.target.value as TextOverlay["position"] } : x)),
                          )
                        }
                        className="rounded-md border bg-transparent px-2 py-1 text-xs"
                      >
                        <option value="top">сверху</option>
                        <option value="center">центр</option>
                        <option value="bottom">снизу</option>
                      </select>
                      <button
                        type="button"
                        className="text-destructive"
                        onClick={() => setTexts((arr) => arr.filter((x) => x.id !== t.id))}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Эффекты</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Фильтр</Label>
                <select value={filter} onChange={(e) => setFilter(e.target.value)} className="mt-1 w-full rounded-md border bg-transparent px-2 py-2 text-sm">
                  {FILTERS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Переход</Label>
                <select value={transition} onChange={(e) => setTransition(e.target.value)} className="mt-1 w-full rounded-md border bg-transparent px-2 py-2 text-sm">
                  {TRANSITIONS.map((tr) => (
                    <option key={tr.id} value={tr.id}>{tr.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Узор</Label>
                <select value={pattern} onChange={(e) => setPattern(e.target.value)} className="mt-1 w-full rounded-md border bg-transparent px-2 py-2 text-sm">
                  {PATTERNS.map((p) => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Сборка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="secondary">обрезка {fmt(trimStart)}–{fmt(trimEnd || videoDur)}</Badge>
                <Badge variant="secondary">скорость x{speed}</Badge>
                <Badge variant="secondary">музыка {volume}%</Badge>
                <Badge variant="secondary">надписей: {texts.length}</Badge>
              </div>
              <Button onClick={buildSpec} disabled={!videoUrl}>Собрать монтаж</Button>
              {spec && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Спецификация монтажа готова. Рендер на сервере (FFmpeg-воркер) — следующий шаг подключения.
                  </p>
                  <pre className="max-h-64 overflow-auto rounded-md border bg-muted/30 p-3 text-xs">{spec}</pre>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
