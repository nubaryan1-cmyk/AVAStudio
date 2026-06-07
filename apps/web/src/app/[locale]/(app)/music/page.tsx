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
  Skeleton,
} from "@avastudio/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { trpc } from "@/lib/trpc";

/**
 * Вкладка «Музыка» — порт из старого интерфейса в новом формате.
 * Два блока: Тренды (детерминированный mock-чарт, интерфейс под реальные
 * Deezer/Apple API в Фазе 2) и Микшер (склейка аудио-ассетов медиатеки).
 */
const PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
type Platform = (typeof PLATFORMS)[number];

function formatUses(n: number): string {
  return n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
}

export default function MusicPage(): JSX.Element {
  const t = useTranslations("Music");
  const utils = trpc.useUtils();

  const [platform, setPlatform] = useState<Platform | null>(null);
  const trends = trpc.music.trends.useQuery(platform ? { platform } : undefined);

  const audio = trpc.media.list.useQuery({ type: "audio" });
  const [selected, setSelected] = useState<string[]>([]);
  const [mixName, setMixName] = useState("");

  const importTrend = trpc.music.importTrend.useMutation({
    onSuccess: () => void utils.media.list.invalidate(),
  });
  const createMix = trpc.music.createMix.useMutation({
    onSuccess: () => {
      setSelected([]);
      setMixName("");
      void utils.media.list.invalidate();
    },
  });

  function toggle(id: string): void {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("trends")}</CardTitle>
          <CardDescription>{t("trendsDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={platform === null ? "default" : "outline"}
              onClick={() => setPlatform(null)}
            >
              {t("all")}
            </Button>
            {PLATFORMS.map((p) => (
              <Button
                key={p}
                size="sm"
                variant={platform === p ? "default" : "outline"}
                onClick={() => setPlatform(p)}
              >
                {t(`platform.${p}`)}
              </Button>
            ))}
          </div>

          {trends.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <ul className="divide-y rounded-md border">
              {(trends.data ?? []).map((trk) => (
                <li key={trk.id} className="flex items-center gap-3 p-3">
                  <span className="w-6 text-center font-mono text-sm text-muted-foreground">
                    {trk.rank}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{trk.title}</div>
                    <div className="truncate text-sm text-muted-foreground">{trk.artist}</div>
                  </div>
                  <Badge variant="secondary">{t(`platform.${trk.platform}`)}</Badge>
                  <span className="w-16 text-right text-sm text-muted-foreground">
                    {formatUses(trk.usesCount)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={importTrend.isPending}
                    onClick={() => importTrend.mutate({ id: trk.id })}
                  >
                    {t("import")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {importTrend.isSuccess ? (
            <p className="text-sm text-green-600">{t("imported")}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("mixer")}</CardTitle>
          <CardDescription>{t("mixerDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {audio.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (audio.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noAudio")}</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {(audio.data ?? []).map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(a.id)}
                    onChange={() => toggle(a.id)}
                    className="h-4 w-4"
                  />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {a.durationSec ?? 0}
                    {t("sec")}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <Label htmlFor="mixName">{t("mixName")}</Label>
            <Input
              id="mixName"
              value={mixName}
              onChange={(e) => setMixName(e.target.value)}
              placeholder={t("mixNamePlaceholder")}
            />
          </div>

          <Button
            disabled={selected.length < 2 || mixName.trim().length === 0 || createMix.isPending}
            onClick={() => createMix.mutate({ name: mixName.trim(), trackIds: selected })}
          >
            {createMix.isPending ? t("mixing") : t("createMix")}
          </Button>
          <p className="text-sm text-muted-foreground">{t("mixHint")}</p>
          {createMix.isError ? (
            <p className="text-sm text-destructive">{createMix.error.message}</p>
          ) : null}
          {createMix.isSuccess ? (
            <p className="text-sm text-green-600">{t("mixDone")}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
