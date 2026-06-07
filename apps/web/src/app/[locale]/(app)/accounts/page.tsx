"use client";



import { PLATFORMS, type Platform } from "@avastudio/shared/domain";
import { IMPL_MECHANISMS, type ImplMechanism } from "@avastudio/shared/social/types";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Skeleton,
} from "@avastudio/ui";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import type { SocialAccount } from "@/server/data/accounts";

import { healthLevel, MECHANISM_LABELS, STATUS_LABELS } from "@/lib/accounts";
import { trpc } from "@/lib/trpc";

const STATUS_VARIANT = {
  warmup: "secondary",
  active: "success",
  authorized: "success",
  checkpoint: "warning",
} as const;

const HEALTH_VARIANT = {
  good: "success",
  warning: "warning",
  bad: "destructive",
} as const;

export default function AccountsPage(): JSX.Element {
  const t = useTranslations("Accounts");
  const [platform, setPlatform] = useState<Platform | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const listQuery = trpc.accounts.list.useQuery(
    platform === "all" ? {} : { platform },
  );
  const detail = trpc.accounts.byId.useQuery(
    { id: selectedId ?? "" },
    { enabled: selectedId !== null },
  );

  const invalidate = async (): Promise<void> => {
    await utils.accounts.invalidate();
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
        <AddAccountDialog onAdded={invalidate} />
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterChip label={t("filterAll")} active={platform === "all"} onClick={() => setPlatform("all")} />
        {PLATFORMS.map((p) => (
          <FilterChip key={p} label={p} active={platform === p} onClick={() => setPlatform(p)} />
        ))}
      </div>

      {listQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listQuery.data?.map((acc) => {
            const hl = healthLevel(acc.healthScore);
            return (
              <Card
                key={acc.id}
                className="cursor-pointer transition-colors hover:border-primary"
                onClick={() => setSelectedId(acc.id)}
              >
                <CardHeader className="space-y-1">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{acc.handle}</CardTitle>
                    <Badge variant={STATUS_VARIANT[acc.status]}>{STATUS_LABELS[acc.status]}</Badge>
                  </div>
                  <CardDescription className="capitalize">{acc.platform}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Health</span>
                    <Badge variant={HEALTH_VARIANT[hl]}>{acc.healthScore}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("phone")}</span>
                    <span>{acc.phoneId ?? "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("proxy")}</span>
                    <span>{acc.proxyId ?? "—"}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {selectedId !== null && (
        <AccountDetail
          loading={detail.isLoading}
          account={detail.data ?? null}
          onClose={() => setSelectedId(null)}
          onChange={invalidate}
        />
      )}
    </div>
  );
}

function FilterChip(props: { label: string; active: boolean; onClick: () => void }): JSX.Element {
  return (
    <Button
      type="button"
      variant={props.active ? "default" : "outline"}
      size="sm"
      className="capitalize"
      onClick={props.onClick}
    >
      {props.label}
    </Button>
  );
}

function AddAccountDialog(props: { onAdded: () => Promise<void> }): JSX.Element {
  const t = useTranslations("Accounts");
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [mechanism, setMechanism] = useState<ImplMechanism>("phone");
  const [handle, setHandle] = useState("");
  const [secret, setSecret] = useState("");

  const add = trpc.accounts.add.useMutation({
    onSuccess: async () => {
      setOpen(false);
      setHandle("");
      setSecret("");
      await props.onAdded();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t("addAccount")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("newAccount")}</DialogTitle>
          <DialogDescription>
            {t("credsNote")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="platform">{t("platform")}</Label>
            <select
              id="platform"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
            >
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mechanism">{t("mechanism")}</Label>
            <select
              id="mechanism"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={mechanism}
              onChange={(e) => setMechanism(e.target.value as ImplMechanism)}
            >
              {IMPL_MECHANISMS.map((m) => (
                <option key={m} value={m}>
                  {MECHANISM_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="handle">{t("handleLabel")}</Label>
            <Input
              id="handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@my.account"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="secret">{t("secretLabel")}</Label>
            <Input
              id="secret"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={add.isPending || handle.length < 2 || secret.length < 1}
            onClick={() => add.mutate({ platform, mechanism, handle, secret })}
          >
            {add.isPending ? t("authorizing") : t("addAndAuth")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AccountData = SocialAccount;

function AccountDetail(props: {
  loading: boolean;
  account: AccountData | null;
  onClose: () => void;
  onChange: () => Promise<void>;
}): JSX.Element {
  const t = useTranslations("Accounts");
  const locale = useLocale();
  const bindPhone = trpc.accounts.bindPhone.useMutation({ onSuccess: () => void props.onChange() });
  const bindProxy = trpc.accounts.bindProxy.useMutation({ onSuccess: () => void props.onChange() });
  const acc = props.account;

  return (
    <Dialog open onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent>
        {props.loading || acc === null ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{acc.handle}</DialogTitle>
              <DialogDescription className="capitalize">
                {acc.platform} · {STATUS_LABELS[acc.status]}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted-foreground">Health</span>
                <span>{acc.healthScore}</span>
                <span className="text-muted-foreground">{t("lastActivity")}</span>
                <span>{new Date(acc.lastActivity).toLocaleString(locale)}</span>
                <span className="text-muted-foreground">{t("phone")}</span>
                <span>{acc.phoneId ?? t("notBound")}</span>
                <span className="text-muted-foreground">{t("proxy")}</span>
                <span>{acc.proxyId ?? t("notBound")}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bindPhone.isPending}
                  onClick={() =>
                    bindPhone.mutate({ id: acc.id, phoneId: acc.phoneId ? null : "phone_demo_1" })
                  }
                >
                  {acc.phoneId ? t("unbindPhone") : t("bindPhone")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={bindProxy.isPending}
                  onClick={() =>
                    bindProxy.mutate({ id: acc.id, proxyId: acc.proxyId ? null : "proxy_demo_1" })
                  }
                >
                  {acc.proxyId ? t("unbindProxy") : t("bindProxy")}
                </Button>
              </div>

              <div>
                <p className="mb-2 font-medium">{t("actionLog")}</p>
                <ul className="space-y-1">
                  {acc.log.map((entry, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="tabular-nums">
                        {new Date(entry.at).toLocaleString(locale)}
                      </span>{" "}
                      — {entry.action}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
