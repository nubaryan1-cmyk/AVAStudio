import { defineRouting } from "next-intl/routing";

/** Поддерживаемые локали. Архитектура рассчитана на добавление любых языков:
 *  достаточно добавить код в `locales` и файл `messages/<code>.json`. */
export const LOCALES = ["ru", "en"] as const;
export type AppLocale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "ru";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  // Локализованные URL вида /ru/... и /en/... всегда с префиксом.
  localePrefix: "always",
});
