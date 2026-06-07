"use client";

import {
  Badge,
  Button,
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

import { trpc } from "@/lib/trpc";

/**
 * Вкладка «Прокси-Пул» — UI над ProxyManager (ЭТАП 12.3).
 * Sticky-привязка прокси к аккаунтам, назначение и ротация. Секреты не показываются.
 */
export default function ProxiesPage(): JSX.Element {
  const t = useTranslations("Proxies");
  const utils = trpc.useUtils();
  const pool = trpc.proxies.pool.useQuery();
  const onDone = (): void => void utils.proxies.pool.invalidate();
  const assign = trpc.proxies.assign.useMutation({ onSuccess: onDone });
  const rotate = trpc.proxies.rotate.useMutation({ onSuccess: onDone });
  const busy = assign.isPending || rotate.isPending;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("poolTitle")}</CardTitle>
          <CardDescription>{t("poolDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {pool.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("account")}</TableHead>
                  <TableHead>{t("platform")}</TableHead>
                  <TableHead>{t("proxy")}</TableHead>
                  <TableHead>{t("reputation")}</TableHead>
                  <TableHead className="text-right">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pool.data ?? []).map((r) => (
                  <TableRow key={r.accountId}>
                    <TableCell className="font-medium">{r.handle}</TableCell>
                    <TableCell className="capitalize">{r.platform}</TableCell>
                    <TableCell>
                      {r.assigned ? (
                        <span className="font-mono text-sm">
                          {r.endpoint}
                          <span className="ml-2 text-muted-foreground">{r.provider}</span>
                        </span>
                      ) : (
                        <Badge variant="outline">{t("unassigned")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.reputation ? (
                        <span className="text-sm text-muted-foreground">
                          ✓{r.reputation.success} · ✕{r.reputation.fail}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.assigned ? (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => rotate.mutate({ accountId: r.accountId })}>
                          {t("rotate")}
                        </Button>
                      ) : (
                        <Button size="sm" disabled={busy} onClick={() => assign.mutate({ accountId: r.accountId })}>
                          {t("assign")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">{t("hint")}</p>
    </div>
  );
}
