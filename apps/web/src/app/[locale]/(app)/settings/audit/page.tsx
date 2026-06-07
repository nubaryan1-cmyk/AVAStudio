"use client";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
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
import { useState } from "react";

import { trpc } from "@/lib/trpc";

/**
 * Журнал аудита (TASK 23.4). Доступ — право audit.view (owner/admin, RBAC ЭТАП 10.4).
 * Фильтры по действию. Phase-1 — in-memory; Phase-2 — audit_log с RLS + retention.
 */
const ACTIONS = [
  "auth.login",
  "account.add",
  "account.delete",
  "billing.subscribe",
  "billing.cancel",
  "security.2fa_enabled",
  "post.publish",
] as const;

export default function AuditPage(): JSX.Element {
  const t = useTranslations("Audit");
  const [action, setAction] = useState<string | null>(null);
  const q = trpc.audit.list.useQuery(action ? { action: action as (typeof ACTIONS)[number] } : undefined);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("events")}</CardTitle>
          <CardDescription>{t("desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAction(null)}
              className={`rounded px-3 py-1 text-sm ${action === null ? "bg-primary text-primary-foreground" : "border"}`}
            >
              {t("all")}
            </button>
            {ACTIONS.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAction(a)}
                className={`rounded px-3 py-1 text-sm ${action === a ? "bg-primary text-primary-foreground" : "border"}`}
              >
                {a}
              </button>
            ))}
          </div>

          {q.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("time")}</TableHead>
                  <TableHead>{t("action")}</TableHead>
                  <TableHead>{t("entity")}</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data ?? []).map((e, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{new Date(e.at).toISOString().replace("T", " ").slice(0, 16)}</TableCell>
                    <TableCell><Badge variant="secondary">{e.action}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{e.entity ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{e.ip ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
