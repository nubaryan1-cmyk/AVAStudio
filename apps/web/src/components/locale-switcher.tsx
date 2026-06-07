"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALES, type AppLocale } from "@/i18n/routing";

/** Переключатель локали. Меняет URL на эквивалент в выбранном языке,
 *  сохраняя текущий путь (next-intl сам подставляет нужный префикс). */
export function LocaleSwitcher(): JSX.Element {
  const t = useTranslations("Locale");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onChange(next: AppLocale): void {
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only">{t("switchLabel")}</span>
      <select
        aria-label={t("switchLabel")}
        value={locale}
        disabled={isPending}
        onChange={(e) => onChange(e.target.value as AppLocale)}
        className="rounded-md border bg-background px-2 py-1 text-sm"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {t(l)}
          </option>
        ))}
      </select>
    </label>
  );
}
