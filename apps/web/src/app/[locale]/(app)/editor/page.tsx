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

import { presetLabel, statusLabel } from "@/lib/editor";
import { trpc } from "@/lib/trpc";

export default function EditorPage(): JSX.Element {
  const t = useTranslations("Editor");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [presetIds, setPresetIds] = useState<string[]>(["brightness", "contrast", "speedUp"]);
  const [profileIds, setProfileIds] = useState<ProfileId[]>(["tiktok"]);
  const [variants, setVariants] = useState(3);
  const [batchId, setBatchId] = useState<string | null>(null);

  const videos = trpc.media.list.useQuery({ type: "video" });
  const presets = trpc.editor.presets.useQuery();
  const profiles = trpc.editor.profiles.useQuery();

  const preview = trpc.editor.preview.useQuery(
    { sourceAssetId: sourceId ?? "", presetIds, seed: 1 },
    { enabled: sourceId !== null },
  );

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

  const togglePreset = (id: string): void =>
    setPresetIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleProfile = (id: ProfileId): void =>
    setProfileIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const canRender = sourceId !== null && profileIds.length > 0 && !enqueue.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("step1")}</CardTitle>
            <CardDescription>{t("step1desc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {videos.isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              <div className="flex flex-wrap gap-2">
                {videos.data?.map((v) => (
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
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("previewTitle")}</CardTitle>
            <CardDescription>{t("previewDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {sourceId === null ? (
              <p className="text-muted-foreground">{t("chooseVideo")}</p>
            ) : preview.isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : preview.data ? (
              <>
                <p className="font-medium">video</p>
                <code className="block break-all rounded bg-muted p-2">
                  {preview.data.videoFilter || "—"}
                </code>
                <p className="font-medium">audio</p>
                <code className="block break-all rounded bg-muted p-2">
                  {preview.data.audioFilter || "—"}
                </code>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("step2")}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {presets.data?.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={presetIds.includes(p.id) ? "default" : "outline"}
                onClick={() => togglePreset(p.id)}
              >
                {p.label}
              </Button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("step3")}</CardTitle>
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
              <Label htmlFor="variants">{t("variants")}</Label>
              <Input
                id="variants"
                type="number"
                min={1}
                max={20}
                value={variants}
                onChange={(e) => setVariants(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              />
            </div>
            <Button
              type="button"
              disabled={!canRender}
              onClick={() =>
                sourceId &&
                enqueue.mutate({ sourceAssetId: sourceId, presetIds, profileIds, variants })
              }
            >
              {enqueue.isPending ? t("starting") : t("renderVariants")}
            </Button>
            {presetIds.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("presetsList", { list: presetIds.map(presetLabel).join(", ") })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {batchId !== null && <RenderProgress jobs={batch.data ?? []} loading={batch.isLoading} />}
    </div>
  );
}

interface JobView {
  id: string;
  variant: number;
  profileId: string;
  progress: number;
  status: "queued" | "active" | "completed";
  resultName: string;
  resultAssetId: string | null;
}

function RenderProgress(props: { jobs: JobView[]; loading: boolean }): JSX.Element {
  const t = useTranslations("Editor");
  const done = useMemo(
    () => props.jobs.filter((j) => j.status === "completed").length,
    [props.jobs],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {t("renderProgress", { count: props.jobs.length > 0 ? `(${done}/${props.jobs.length})` : "" })}
        </CardTitle>
        <CardDescription>{t("resultsNote")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {props.loading && props.jobs.length === 0 ? (
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
