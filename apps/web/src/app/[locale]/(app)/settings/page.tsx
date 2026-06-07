"use client";

import {
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
import { useEffect, useState } from "react";

import { trpc } from "@/lib/trpc";

const THEMES = ["system", "light", "dark"] as const;
const LANGUAGES = ["ru", "en"] as const;
const PLATFORMS = ["tiktok", "instagram", "reddit", "threads"] as const;

/**
 * Вкладка «Настройки» — профиль и предпочтения. Phase-1: in-memory.
 */
export default function SettingsPage(): JSX.Element {
  const t = useTranslations("Settings");
  const utils = trpc.useUtils();
  const q = trpc.settings.get.useQuery();
  const save = trpc.settings.update.useMutation({ onSuccess: () => void utils.settings.get.invalidate() });

  const [name, setName] = useState("");
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>("ru");
  const [theme, setTheme] = useState<(typeof THEMES)[number]>("system");
  const [platform, setPlatform] = useState<string>("tiktok");
  const [notif, setNotif] = useState(true);

  useEffect(() => {
    if (q.data) {
      setName(q.data.displayName);
      setLanguage(q.data.language);
      setTheme(q.data.theme);
      setPlatform(q.data.defaultPlatform);
      setNotif(q.data.emailNotifications);
    }
  }, [q.data]);

  if (q.isLoading || !q.data) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile")}</CardTitle>
          <CardDescription>{t("profileDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("displayName")}</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" value={q.data.email} disabled />
            <p className="text-xs text-muted-foreground">{t("emailHint")}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("preferences")}</CardTitle>
          <CardDescription>{t("preferencesDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label={t("language")}>
            {LANGUAGES.map((l) => (
              <Button key={l} size="sm" variant={language === l ? "default" : "outline"} onClick={() => setLanguage(l)}>
                {t(`lang.${l}`)}
              </Button>
            ))}
          </Field>
          <Field label={t("theme")}>
            {THEMES.map((th) => (
              <Button key={th} size="sm" variant={theme === th ? "default" : "outline"} onClick={() => setTheme(th)}>
                {t(`themeLabel.${th}`)}
              </Button>
            ))}
          </Field>
          <Field label={t("defaultPlatform")}>
            {PLATFORMS.map((p) => (
              <Button key={p} size="sm" variant={platform === p ? "default" : "outline"} className="capitalize" onClick={() => setPlatform(p)}>
                {p}
              </Button>
            ))}
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notif} onChange={(e) => setNotif(e.target.checked)} className="h-4 w-4" />
            {t("emailNotifications")}
          </label>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          disabled={save.isPending}
          onClick={() =>
            save.mutate({ displayName: name.trim(), language, theme, defaultPlatform: platform, emailNotifications: notif })
          }
        >
          {save.isPending ? t("saving") : t("save")}
        </Button>
        {save.isSuccess ? <span className="text-sm text-green-600">{t("saved")}</span> : null}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
