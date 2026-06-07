"use client";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from "@avastudio/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";

import type { MetricPoint } from "@/server/data/stats";

import { trpc } from "@/lib/trpc";

/**
 * Переиспользуемое представление аналитики.
 * Рендерится как на странице /analytics, так и внутри /dashboard.
 * Сводка + графики (inline SVG, без внешних зависимостей) + разбивка по площадкам.
 */
const RANGES = [7, 30, 90] as const;
type Range = (typeof RANGES)[number];

function nf(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function LineChart({ points }: { points: MetricPoint[] }): JSX.Element {
  const w = 640;
  const h = 160;
  const pad = 8;
  const max = Math.max(...points.map((p) => p.value), 1);
  const min = Math.min(...points.map((p) => p.value), 0);
  const span = max - min || 1;
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = pad + i * step;
    const y = pad + (h - pad * 2) * (1 - (p.value - min) / span);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${coords[coords.length - 1]![0].toFixed(1)},${h - pad} L${coords[0]![0].toFixed(1)},${h - pad} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" preserveAspectRatio="none" role="img">
      <path d={area} fill="hsl(var(--primary) / 0.12)" />
      <path d={line} fill="none" stroke="hsl(var(--primary))" strokeWidth={2} />
    </svg>
  );
}

function BarChart({ points }: { points: MetricPoint[] }): JSX.Element {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div className="flex h-40 items-end gap-1">
      {points.map((p) => (
        <div
          key={p.date}
          className="flex-1 rounded-t bg-primary/70"
          style={{ height: `${Math.max(4, (p.value / max) * 100)}%` }}
          title={`${p.date}: ${p.value}`}
        />
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

/** showHeading=false убирает крупный заголовок, когда блок встраивается в дашборд. */
export function AnalyticsView({ showHeading = true }: { showHeading?: boolean }): JSX.Element {
  const t = useTranslations("Analytics");
  const [range, setRange] = useState<Range>(30);
  const q = trpc.stats.overview.useQuery({ range });
  const data = q.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {showHeading ? (
            <h1 className="text-2xl font-bold">{t("title")}</h1>
          ) : (
            <h2 className="text-xl font-semibold">{t("title")}</h2>
          )}
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-1 rounded-md border p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded px-3 py-1 text-sm ${range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              {t("days", { n: r })}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {q.isLoading || !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : (
          <>
            <Stat label={t("views")} value={nf(data.summary.views)} />
            <Stat label={t("posts")} value={nf(data.summary.posts)} />
            <Stat label={t("followers")} value={`+${nf(data.summary.followersGained)}`} />
            <Stat label={t("engagement")} value={`${data.summary.engagementRate}%`} />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("viewsChart")}</CardTitle>
            <CardDescription>{t("viewsChartDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {q.isLoading || !data ? <Skeleton className="h-40 w-full" /> : <LineChart points={data.views} />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t("postsChart")}</CardTitle>
            <CardDescription>{t("postsChartDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {q.isLoading || !data ? <Skeleton className="h-40 w-full" /> : <BarChart points={data.posts} />}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("byPlatform")}</CardTitle>
          <CardDescription>{t("byPlatformDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {q.isLoading || !data ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <ul className="space-y-3">
              {data.byPlatform.map((p) => (
                <li key={p.platform} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium capitalize">
                      {p.platform}
                      <Badge variant="secondary">{p.share}%</Badge>
                    </span>
                    <span className="text-muted-foreground">
                      {nf(p.views)} {t("views").toLowerCase()} · {nf(p.posts)} {t("posts").toLowerCase()}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${p.share}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
