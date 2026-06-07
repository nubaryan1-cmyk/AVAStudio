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
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import type { PlanId } from "@avastudio/shared/billing";
import type { Money } from "@avastudio/shared/payments";

import {
  formatMoney,
  METRIC_LABELS,
  PAYMENT_METHOD_LABELS,
  usageLevel,
  type PaymentMethod,
} from "@/lib/billing";
import { trpc } from "@/lib/trpc";

const USAGE_BAR: Record<"good" | "warning" | "bad", string> = {
  good: "bg-primary",
  warning: "bg-warning",
  bad: "bg-destructive",
};

export default function BillingPage(): JSX.Element {
  const t = useTranslations("Billing");
  const format = useFormatter();
  const state = trpc.billing.state.useQuery();
  const [promo, setPromo] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("card");

  const applyPromo = trpc.billing.applyPromo.useMutation();
  const upgrade = trpc.billing.upgrade.useMutation();

  // Локализованная валюта/числа через Intl (для fiat). Крипто — спец-формат.
  function money(m: Money): string {
    if (m.kind === "fiat") {
      return format.number(Number(m.amount), { style: "currency", currency: m.currency });
    }
    return formatMoney(m);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {state.isLoading || !state.data ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{t("currentPlan")}</CardTitle>
                  <CardDescription>
                    {money(state.data.price)} {t("perMonth")}
                  </CardDescription>
                </div>
                <Badge variant="success">{state.data.planName}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {state.data.usage.map((u) => {
                const level = usageLevel(u.ratio);
                return (
                  <div key={u.metric} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{METRIC_LABELS[u.metric]}</span>
                      <span className="text-muted-foreground">
                        {format.number(u.used)} / {u.limit === null ? "∞" : format.number(u.limit)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded bg-muted">
                      <div
                        className={`h-full ${USAGE_BAR[level]}`}
                        style={{ width: `${Math.round(u.ratio * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("upgrade")}</CardTitle>
                <CardDescription>{t("upgradeHint")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  {(["card", "crypto"] as PaymentMethod[]).map((m) => (
                    <Button
                      key={m}
                      type="button"
                      size="sm"
                      variant={method === m ? "default" : "outline"}
                      onClick={() => setMethod(m)}
                    >
                      {PAYMENT_METHOD_LABELS[m]}
                    </Button>
                  ))}
                </div>
                <div className="space-y-2">
                  {state.data.availablePlans
                    .filter((p) => p.id !== state.data!.planId)
                    .map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-md border p-2">
                        <span className="text-sm">
                          {p.name} — {money(p.price)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={upgrade.isPending}
                          onClick={() => upgrade.mutate({ planId: p.id as PlanId, method })}
                        >
                          {t("choose")}
                        </Button>
                      </div>
                    ))}
                </div>
                {upgrade.data && (
                  <div className="rounded-md bg-muted p-3 text-xs">
                    <p className="font-medium">{t("checkoutCreated", { method: upgrade.data.method })}</p>
                    <p className="break-all text-muted-foreground">{upgrade.data.url}</p>
                    {upgrade.data.cryptoAddress && (
                      <p className="break-all text-muted-foreground">
                        {t("address", {
                          network: upgrade.data.cryptoNetwork ?? "",
                          value: upgrade.data.cryptoAddress,
                        })}
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("promo")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="promo">{t("code")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="promo"
                      value={promo}
                      onChange={(e) => setPromo(e.target.value)}
                      placeholder="WELCOME20"
                    />
                    <Button
                      type="button"
                      disabled={promo.length === 0 || applyPromo.isPending}
                      onClick={() => applyPromo.mutate({ code: promo })}
                    >
                      {t("apply")}
                    </Button>
                  </div>
                </div>
                {applyPromo.data && (
                  <Badge variant={applyPromo.data.valid ? "success" : "destructive"}>
                    {applyPromo.data.message}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("history")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {state.data.history.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between py-2">
                    <span className="tabular-nums text-muted-foreground">
                      {format.dateTime(new Date(inv.date), { dateStyle: "medium" })}
                    </span>
                    <span>{inv.planName}</span>
                    <span>{money(inv.amount)}</span>
                    <Badge variant={inv.status === "paid" ? "success" : "secondary"}>
                      {inv.status === "paid" ? t("paid") : t("refunded")}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
