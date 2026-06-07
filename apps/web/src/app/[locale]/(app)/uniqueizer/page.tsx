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
import { useMemo, useState } from "react";

import type { ProfileId } from "@avastudio/media";

import { statusLabel } from "@/lib/editor";
import { trpc } from "@/lib/trpc";

/**
 * Вкладка «Уникализация» — порт конвейера из старого интерфейса в новом формате.
 * Понятный линейный флоу: видео → фичи уникализации → число копий → платформа →
 * запуск → живой прогресс. Под капотом — готовый editor-роутер (пресеты
 * @avastudio/media, очередь рендера). Каждая «фича» = группа пресетов движка.
 */
interface Feature {
  key: string;
  presets: string[];
}
const FEATURES: Feature[] = [
  { key: "mirror", presets: ["mirror"] },
  { key: "color", presets: ["brightness", "contrast", "saturation"] },
  { key: "crop", presets: ["crop"] },
  { key: "rotate", presets: ["rotate"] },
  { key: "noise", presets: ["addNoise"] },
  { key: "vignette", presets: ["vignette"] },
  { key: "sharpen", presets: ["sharpen"] },
  { key: "endFreeze", presets: ["endFreeze"] },
];

export default function UniqueizerPage(): JSX.Element {
  const t = useTranslations("Uniqueizer");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [active, setActive] = useState<string[]>(["mirror", "color", "crop"]);
  const [profileIds, setProfileIds] = useState<ProfileId[]>(["tiktok"]);
  const [count, setCount] = useState(5);
  const [batchId, setBatchId] = useState<string | null>(null);

  const videos = trpc.media.list.useQuery({ type: "video" });
  const profiles = trpc.editor.profiles.useQuery();

  const batch = trpc.editor.batch.useQuery(
    { batchId: batchId ?? "" },
    {
      enabled: batchId !== null,
      refetchInterval: (q) =>
        (q.state.data ?? []).some((j) => j.status !== "completed") ? 800 : false,
    },
  );

  const enqueue = trpc.editor.enqueue.useMutation({
    onSuccess: (res) => setBatchId(res.batchId),
  });

  const presetIds = useMemo(
    () => [...new Set(FEATURES.filter((f) => active.includes(f.key)).flatMap((f) => f.presets))],
    [active],
  );

  const toggleFeature = (key: string): void =>
    setActive((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));
  const toggleProfile = (id: ProfileId): void =>
    setProfileIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const canRun =
    sourceId !== null && active.length > 0 && profileIds.length > 0 && !enqueue.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("step1")}</CardTitle>
            <CardDescription>{t("step1desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {videos.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : videos.data && videos.data.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {videos.data.map((v) => (
                  <Button
                    key={v.id}
                    type="button"
                    size="sm"
                    variant={sourceId === v.id ? "default" : "outline"}
                    onClick={() => {
                      setSourceId(v.id);
                      setBatchId(null);
                    }}
                  >
                    {v.name}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("noVideos")}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("step2")}</CardTitle>
            <CardDescription>{t("step2desc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {FEATURES.map((f) => (
              <Button
                key={f.key}
                type="button"
                size="sm"
                variant={active.includes(f.key) ? "default" : "outline"}
                onClick={() => toggleFeature(f.key)}
              >
                {t(`feature.${f.key}`)}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("step3")}</CardTitle>
            <CardDescription>{t("step3desc")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {profiles.data?.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={profileIds.includes(p.id) ? "default" : "outline"}
                onClick={() => toggleProfile(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("step4")}</CardTitle>
            <CardDescription>{t("step4desc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="count">{t("count")}</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={20}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              />
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={!canRun}
              onClick={() =>
                sourceId &&
                enqueue.mutate({ sourceAssetId: sourceId, presetIds, profileIds, variants: count })
              }
            >
              {enqueue.isPending ? t("starting") : t("run")}
            </Button>
            {enqueue.isError ? (
              <p className="text-sm font-medium text-destructive" role="alert">
                {enqueue.error.message}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">{t("hint")}</p>
          </CardContent>
        </Card>
      </div>

      {batchId !== null ? <Progress jobs={batch.data ?? []} loading={batch.isLoading} /> : null}
    </div>
  );
}

interface JobView {
  id: string;
  progress: number;
  status: "queued" | "active" | "completed";
  resultName: string;
}

function Progress(props: { jobs: JobView[]; loading: boolean }): JSX.Element {
  const t = useTranslations("Uniqueizer");
  const done = useMemo(
    () => props.jobs.filter((j) => j.status === "completed").length,
    [props.jobs],
  );
  const total = props.jobs.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("progress")} {total > 0 ? `${done}/${total}` : ""}
        </CardTitle>
        <CardDescription>{t("resultsNote")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.loading && total === 0 ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          props.jobs.map((j) => (
            <div key={j.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="truncate">{j.resultName}</span>
                <Badge variant={j.status === "completed" ? "success" : "secondary"}>
                  {statusLabel(j.status)}
                </Badge>
              </div>
              <div className="h-2 w-full overflow-hidden rounded bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${j.progress}%` }}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
