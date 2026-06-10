"use client";

import { Badge, Button, Card, CardContent, Label, Tabs, TabsContent, TabsList, TabsTrigger } from "@avastudio/ui";
import { useRef, useState } from "react";

import { trpc } from "@/lib/trpc";

type Kind = "image" | "video" | "audio";

interface ModelOpt {
  id: string;
  label: string;
}

const MODELS: Record<Kind, ModelOpt[]> = {
  image: [{ id: "fal-ai/nano-banana", label: "Nano Banana (Google)" }],
  video: [
    { id: "fal-ai/veo3", label: "Veo 3 (Google)" },
    { id: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video", label: "Kling" },
    { id: "fal-ai/bytedance/seedance/v1/pro/text-to-video", label: "Seedance" },
  ],
  audio: [{ id: "fal-ai/elevenlabs/tts/multilingual-v2", label: "Озвучка (ElevenLabs)" }],
};

interface FalResult {
  images?: { url: string }[];
  image?: { url: string };
  video?: { url: string };
  audio?: { url: string };
  audio_url?: string;
}

function GenPanel({ kind }: { kind: Kind }): JSX.Element {
  const personas = trpc.personas.list.useQuery();
  const [model, setModel] = useState(MODELS[kind][0]!.id);
  const [prompt, setPrompt] = useState("");
  const [personaId, setPersonaId] = useState<string>("");
  const [showPersonas, setShowPersonas] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FalResult | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const persona = (personas.data ?? []).find((p) => p.id === personaId);

  async function generate(): Promise<void> {
    if (!prompt.trim()) {
      setStatus("Введите промт");
      return;
    }
    setBusy(true);
    setResult(null);
    setStatus("Ставлю в очередь…");
    // Контекст персонажа добавляем к промту
    const fullPrompt = persona
      ? `${prompt}\n\n[Стиль персонажа «${persona.name}»: ${persona.tone}, ниша ${persona.niche}. ${persona.promptTemplate}]`
      : prompt;
    // Если у персонажа есть фото лица и это ФОТО — используем PuLID для консистентности лица.
    const ref = (persona as { referenceImageUrl?: string } | undefined)?.referenceImageUrl;
    const useFace = kind === "image" && Boolean(ref);
    const effModel = useFace ? "fal-ai/flux-pulid" : model;
    const extra = useFace ? { reference_image_url: ref } : undefined;
    try {
      const r = await fetch("/api/ai/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: effModel, prompt: fullPrompt, ...(extra ? { extra } : {}) }),
      });
      const j = (await r.json()) as { ok: boolean; statusUrl?: string; responseUrl?: string; error?: string };
      if (!j.ok || !j.statusUrl || !j.responseUrl) {
        setStatus(`Ошибка: ${j.error ?? "неизвестно"}`);
        setBusy(false);
        return;
      }
      setStatus("Генерация…");
      const { statusUrl, responseUrl } = j;
      if (poll.current) clearInterval(poll.current);
      poll.current = setInterval(() => {
        void (async () => {
          const rr = await fetch("/api/ai/result", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ statusUrl, responseUrl }),
          });
          const jj = (await rr.json()) as { ok: boolean; status?: string; result?: FalResult; error?: string };
          if (!jj.ok) {
            setStatus(`Ошибка: ${jj.error ?? "неизвестно"}`);
            if (poll.current) clearInterval(poll.current);
            setBusy(false);
            return;
          }
          if (jj.status === "COMPLETED") {
            if (poll.current) clearInterval(poll.current);
            setResult(jj.result ?? null);
            setStatus("Готово");
            setBusy(false);
          } else {
            setStatus(jj.status === "IN_PROGRESS" ? "Генерация…" : "В очереди…");
          }
        })();
      }, 3000);
    } catch (e) {
      setStatus(`Ошибка: ${e instanceof Error ? e.message : String(e)}`);
      setBusy(false);
    }
  }

  const imgUrl = result?.images?.[0]?.url ?? result?.image?.url;
  const vidUrl = result?.video?.url;
  const audUrl = result?.audio?.url ?? result?.audio_url;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <Label>Модель</Label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            >
              {MODELS[kind].map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="prompt">Промт</Label>
              <button
                type="button"
                onClick={() => setShowPersonas((v) => !v)}
                className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent"
                title="Выбрать персонажа"
              >
                @ {persona ? persona.name : "персонаж"}
              </button>
            </div>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Опиши, что сгенерировать…"
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-2 text-sm"
            />
            {showPersonas && (
              <div className="mt-2 rounded-md border p-2">
                {(personas.data ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Персонажей нет — добавь во вкладке «AI-Персоны».</p>
                ) : (
                  <ul className="space-y-1">
                    <li>
                      <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => { setPersonaId(""); setShowPersonas(false); }}>
                        Без персонажа
                      </button>
                    </li>
                    {(personas.data ?? []).map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="text-sm hover:underline"
                          onClick={() => { setPersonaId(p.id); setShowPersonas(false); }}
                        >
                          @{p.name} <span className="text-xs text-muted-foreground">· {p.niche}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <Button disabled={busy} onClick={() => void generate()}>
            {busy ? "Генерация…" : "Сгенерировать"}
          </Button>
          {status && <p className="text-sm text-muted-foreground">{status}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex min-h-[300px] items-center justify-center pt-6">
          {imgUrl ? (
            <img src={imgUrl} alt="результат" className="max-h-[420px] w-full rounded-lg object-contain" />
          ) : vidUrl ? (
            <video src={vidUrl} controls className="max-h-[420px] w-full rounded-lg bg-black" />
          ) : audUrl ? (
            <audio src={audUrl} controls className="w-full" />
          ) : (
            <p className="text-sm text-muted-foreground">Результат появится здесь</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function GeneratePage(): JSX.Element {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">AI-Генерация</h1>
        <Badge variant="secondary">fal.ai</Badge>
      </div>
      <Tabs defaultValue="image">
        <TabsList>
          <TabsTrigger value="image">ФОТО</TabsTrigger>
          <TabsTrigger value="video">ВИДЕО</TabsTrigger>
          <TabsTrigger value="audio">ОЗВУЧКА</TabsTrigger>
        </TabsList>
        <TabsContent value="image" className="mt-6">
          <GenPanel kind="image" />
        </TabsContent>
        <TabsContent value="video" className="mt-6">
          <GenPanel kind="video" />
        </TabsContent>
        <TabsContent value="audio" className="mt-6">
          <GenPanel kind="audio" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
