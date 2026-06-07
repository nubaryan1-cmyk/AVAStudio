"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Skeleton,
} from "@avastudio/ui";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { isPrimeTime, postStatusLabel, type PostStatus } from "@/lib/scheduling";
import { trpc } from "@/lib/trpc";

const STATUS_VARIANT: Record<PostStatus, "secondary" | "warning" | "success" | "destructive"> = {
  scheduled: "secondary",
  posting: "warning",
  posted: "success",
  failed: "destructive",
};


function startOfWeek(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7; // Пн=0
  date.setDate(date.getDate() - day);
  return date;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarPage(): JSX.Element {
  const t = useTranslations("Calendar");
  const locale = useLocale();
  const WEEKDAYS = t.raw("weekdays") as string[];
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [dragId, setDragId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const posts = trpc.scheduling.posts.useQuery(undefined, {
    refetchInterval: (q) => ((q.state.data ?? []).some((p) => p.status === "posting") ? 1500 : false),
  });
  const reschedule = trpc.scheduling.reschedule.useMutation({
    onSuccess: () => void utils.scheduling.posts.invalidate(),
  });

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86_400_000)),
    [weekStart],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, typeof posts.data>();
    for (const p of posts.data ?? []) {
      const key = dayKey(new Date(p.scheduledAt));
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [posts.data]);

  const onDrop = (day: Date): void => {
    if (dragId === null) return;
    const post = posts.data?.find((p) => p.id === dragId);
    setDragId(null);
    if (!post) return;
    const old = new Date(post.scheduledAt);
    const next = new Date(day);
    next.setHours(old.getHours(), old.getMinutes(), 0, 0);
    reschedule.mutate({ id: post.id, scheduledAt: next.toISOString() });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 86_400_000))}
          >
            {t("prevWeek")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            {t("today")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 86_400_000))}
          >
            {t("nextWeek")}
          </Button>
        </div>
      </div>

      <SchedulePostForm />

      {posts.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          {days.map((day, i) => {
            const key = dayKey(day);
            const dayPosts = byDay.get(key) ?? [];
            return (
              <div
                key={key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(day)}
                className="min-h-40 rounded-lg border border-input p-2"
              >
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  {WEEKDAYS[i]} {day.getDate()}.{String(day.getMonth() + 1).padStart(2, "0")}
                </div>
                <div className="space-y-2">
                  {dayPosts.map((p) => (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={() => setDragId(p.id)}
                      onDragEnd={() => setDragId(null)}
                      className="cursor-grab rounded-md border bg-card p-2 text-xs shadow-sm active:cursor-grabbing"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate font-medium">{p.accountHandle}</span>
                        <Badge variant={STATUS_VARIANT[p.status]}>{postStatusLabel(p.status)}</Badge>
                      </div>
                      <div className="truncate text-muted-foreground">{p.assetName}</div>
                      <div className="text-muted-foreground">
                        {new Date(p.scheduledAt).toLocaleTimeString(locale, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {!isPrimeTime(new Date(p.scheduledAt).getHours()) && (
                          <span className="ml-1 text-warning">{t("offPrime")}</span>
                        )}
                      </div>
                      {p.error && <div className="text-destructive">{p.error}</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SchedulePostForm(): JSX.Element {
  const t = useTranslations("Calendar");
  const utils = trpc.useUtils();
  const accounts = trpc.scheduling.accounts.useQuery();
  const videos = trpc.media.list.useQuery({ type: "video" });

  const [accountId, setAccountId] = useState("");
  const [assetId, setAssetId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:00");

  const scheduledAt = useMemo(() => {
    if (!date) return "";
    const d = new Date(`${date}T${time}:00`);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  }, [date, time]);

  const conflicts = trpc.scheduling.conflicts.useQuery(
    { accountId, scheduledAt },
    { enabled: accountId !== "" && scheduledAt !== "" },
  );

  const schedule = trpc.scheduling.schedule.useMutation({
    onSuccess: () => {
      void utils.scheduling.posts.invalidate();
      setAssetId("");
      setDate("");
    },
  });

  const ready = accountId !== "" && assetId !== "" && scheduledAt !== "" && !schedule.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("scheduleTitle")}</CardTitle>
        <CardDescription>{t("scheduleDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="acc">{t("account")}</Label>
            <select
              id="acc"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            >
              <option value="">—</option>
              {accounts.data?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.handle} ({a.platform})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="asset">{t("content")}</Label>
            <select
              id="asset"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
            >
              <option value="">—</option>
              {videos.data?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">{t("date")}</Label>
            <input
              id="date"
              type="date"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="time">{t("time")}</Label>
            <input
              id="time"
              type="time"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        {conflicts.data && conflicts.data.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {conflicts.data.map((c, i) => (
              <Badge key={i} variant="warning">
                ⚠ {c.message}
              </Badge>
            ))}
          </div>
        )}

        <Button
          type="button"
          disabled={!ready}
          onClick={() => schedule.mutate({ accountId, assetId, scheduledAt })}
        >
          {schedule.isPending ? t("scheduling") : t("schedule")}
        </Button>
      </CardContent>
    </Card>
  );
}
