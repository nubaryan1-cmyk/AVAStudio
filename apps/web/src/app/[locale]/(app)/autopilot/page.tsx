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
 * Вкладка «Центр Автозалива» — порт /api/autopilot|uploader в новый формат.
 * Линейный флоу: ассет → аккаунты → число публикаций → запуск.
 * Автопилот раскидывает посты по прайм-тайму (18:00–22:00) с учётом лимитов площадок.
 */
export default function AutopilotPage(): JSX.Element {
  const t = useTranslations("Autopilot");
  const utils = trpc.useUtils();

  const media = trpc.media.list.useQuery({ type: "video" });
  const accounts = trpc.autopilot.accounts.useQuery();

  const [assetId, setAssetId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [perAccount, setPerAccount] = useState(3);
  const [caption, setCaption] = useState("");

  const run = trpc.autopilot.run.useMutation({
    onSuccess: () => void utils.scheduling.posts.invalidate(),
  });

  function toggle(id: string): void {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  const total = selected.length * perAccount;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("step1")}</CardTitle>
          <CardDescription>{t("step1Desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {media.isLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : (media.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noVideos")}</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(media.data ?? []).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setAssetId(m.id)}
                  className={`rounded-md border p-3 text-left text-sm ${assetId === m.id ? "border-primary ring-1 ring-primary" : ""}`}
                >
                  <div className="truncate font-medium">{m.name}</div>
                  <div className="text-muted-foreground">{m.durationSec ?? 0}s</div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("step2")}</CardTitle>
          <CardDescription>{t("step2Desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <ul className="divide-y rounded-md border">
              {(accounts.data ?? []).map((a) => (
                <li key={a.id} className="flex items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(a.id)}
                    onChange={() => toggle(a.id)}
                    className="h-4 w-4"
                  />
                  <span className="flex-1 truncate font-medium">{a.handle}</span>
                  <Badge variant="secondary" className="capitalize">{a.platform}</Badge>
                  <span className="text-sm text-muted-foreground">{t("maxPerDay", { n: a.maxPostsPerDay })}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("step3")}</CardTitle>
          <CardDescription>{t("step3Desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Label htmlFor="per" className="w-48">{t("perAccount")}</Label>
            <Input
              id="per"
              type="number"
              min={1}
              max={14}
              value={perAccount}
              onChange={(e) => setPerAccount(Math.max(1, Math.min(14, Number(e.target.value) || 1)))}
              className="w-24"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cap">{t("caption")}</Label>
            <Input id="cap" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t("captionPlaceholder")} />
          </div>
          <p className="text-sm text-muted-foreground">{t("totalHint", { n: total })}</p>
          <Button
            disabled={assetId === null || selected.length === 0 || run.isPending}
            onClick={() =>
              run.mutate({
                assetId: assetId!,
                accountIds: selected,
                postsPerAccount: perAccount,
                caption: caption.trim() === "" ? undefined : caption.trim(),
              })
            }
          >
            {run.isPending ? t("running") : t("run")}
          </Button>
          {run.isError ? <p className="text-sm text-destructive">{run.error.message}</p> : null}
          {run.isSuccess ? (
            <p className="text-sm text-green-600">{t("done", { n: run.data.created })}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
