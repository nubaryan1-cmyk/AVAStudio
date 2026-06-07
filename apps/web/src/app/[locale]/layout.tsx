import { ThemeProvider } from "@avastudio/ui";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import "../globals.css";

import type { Metadata } from "next";

import { routing } from "@/i18n/routing";


// Системный шрифт (без загрузки из Google Fonts) — работает офлайн.
const FONT_STACK =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function generateStaticParams(): Array<{ locale: string }> {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return { title: t("title"), description: t("description") };
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className="font-sans antialiased"
        style={{ ["--font-sans" as never]: FONT_STACK }}
      >
        <NextIntlClientProvider>
          <ThemeProvider defaultTheme="light">{children}</ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
