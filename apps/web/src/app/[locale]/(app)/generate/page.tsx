"use client";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@avastudio/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { trpc } from "@/lib/trpc";

/**
 * Вкладка «AI-Генерация» — UI над AI-реестром (ЭТАП 11).
 * Три режима: изображение, озвучка (TTS), музыка. Результат уходит в медиатеку.
 * Фаза 1 — mock-провайдеры с fallback; реальные API — Фаза 2.
 */
export default function GeneratePage(): JSX.Element {
  const t = useTranslations("Generate");
  const utils = trpc.useUtils();
  const onDone = (): void => void utils.media.list.invalidate();

  const [imgPrompt, setImgPrompt] = useState("");
  const [ttsText, setTtsText] = useState("");
  const [musicPrompt, setMusicPrompt] = useState("");
  const [musicDur, setMusicDur] = useState(30);

  const image = trpc.generation.image.useMutation({ onSuccess: onDone });
  const tts = trpc.generation.tts.useMutation({ onSuccess: onDone });
  const music = trpc.generation.music.useMutation({ onSuccess: onDone });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="image">
        <TabsList>
          <TabsTrigger value="image">{t("tab.image")}</TabsTrigger>
          <TabsTrigger value="tts">{t("tab.tts")}</TabsTrigger>
          <TabsTrigger value="music">{t("tab.music")}</TabsTrigger>
        </TabsList>

        <TabsContent value="image">
          <Card>
            <CardHeader>
              <CardTitle>{t("image.title")}</CardTitle>
              <CardDescription>{t("image.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="imgp">{t("prompt")}</Label>
                <Input id="imgp" value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} placeholder={t("image.placeholder")} />
              </div>
              <Button disabled={imgPrompt.trim() === "" || image.isPending} onClick={() => image.mutate({ prompt: imgPrompt.trim() })}>
                {image.isPending ? t("generating") : t("generate")}
              </Button>
              {image.isSuccess ? (
                <p className="text-sm text-green-600">{t("done", { provider: image.data.provider, ms: image.data.latencyMs })}</p>
              ) : null}
              {image.isError ? <p className="text-sm text-destructive">{image.error.message}</p> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tts">
          <Card>
            <CardHeader>
              <CardTitle>{t("tts.title")}</CardTitle>
              <CardDescription>{t("tts.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ttst">{t("tts.text")}</Label>
                <Input id="ttst" value={ttsText} onChange={(e) => setTtsText(e.target.value)} placeholder={t("tts.placeholder")} />
              </div>
              <Button disabled={ttsText.trim() === "" || tts.isPending} onClick={() => tts.mutate({ text: ttsText.trim() })}>
                {tts.isPending ? t("generating") : t("generate")}
              </Button>
              {tts.isSuccess ? (
                <p className="text-sm text-green-600">{t("done", { provider: tts.data.provider, ms: tts.data.latencyMs })}</p>
              ) : null}
              {tts.isError ? <p className="text-sm text-destructive">{tts.error.message}</p> : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="music">
          <Card>
            <CardHeader>
              <CardTitle>{t("music.title")}</CardTitle>
              <CardDescription>{t("music.desc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mp">{t("prompt")}</Label>
                <Input id="mp" value={musicPrompt} onChange={(e) => setMusicPrompt(e.target.value)} placeholder={t("music.placeholder")} />
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="md" className="w-40">{t("music.duration")}</Label>
                <Input
                  id="md"
                  type="number"
                  min={5}
                  max={300}
                  value={musicDur}
                  onChange={(e) => setMusicDur(Math.max(5, Math.min(300, Number(e.target.value) || 5)))}
                  className="w-24"
                />
              </div>
              <Button disabled={musicPrompt.trim() === "" || music.isPending} onClick={() => music.mutate({ prompt: musicPrompt.trim(), durationSec: musicDur })}>
                {music.isPending ? t("generating") : t("generate")}
              </Button>
              {music.isSuccess ? (
                <p className="text-sm text-green-600">{t("done", { provider: music.data.provider, ms: music.data.latencyMs })}</p>
              ) : null}
              {music.isError ? <p className="text-sm text-destructive">{music.error.message}</p> : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
