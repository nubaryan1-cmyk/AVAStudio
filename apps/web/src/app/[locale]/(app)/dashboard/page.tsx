"use client";

import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@avastudio/ui";
import { useTranslations } from "next-intl";

import { AnalyticsView } from "../analytics/analytics-view";

import { METRIC_LABELS, usagePercent } from "@/lib/dashboard";
import { trpc } from "@/lib/trpc";

const STATUS_VARIANT = {
  completed: "success",
  active: "default",
  waiting: "secondary",
  failed: "destructive",
} as const;

export default function DashboardPage(): JSX.Element {
  const t = useTranslations("Dashboard");
  const { data, isLoading } = trpc.dashboard.summary.useQuery();

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t("accounts")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{data.accountsCount}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t("postsThisWeek")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{data.postsThisWeek}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t("jobsInProgress")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">
            {data.recentJobs.filter((j) => j.status === "active" || j.status === "waiting").length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t("problemAccounts")}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{data.issues.length}</CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("usageLimits")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.usage.map((row) => (
              <div key={row.metric}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{METRIC_LABELS[row.metric]}</span>
                  <span className="text-muted-foreground">
                    {row.used} / {row.limit ?? "∞"}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${usagePercent(row.used, row.limit)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("recentJobs")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colKind")}</TableHead>
                  <TableHead>{t("colPlatform")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{job.kind}</TableCell>
                    <TableCell>{job.platform ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[job.status]}>{job.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {data.issues.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("issuesHeading")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.issues.map((issue) => (
              <div key={issue.accountId} className="flex items-center gap-3 text-sm">
                <Badge variant="warning">{issue.kind}</Badge>
                <span className="font-medium">{issue.handle}</span>
                <span className="text-muted-foreground">{issue.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <AnalyticsView showHeading={false} />
    </div>
  );
}
