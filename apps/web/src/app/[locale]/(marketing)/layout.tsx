import { ThemeToggle } from "@avastudio/ui";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import type { Metadata } from "next";
import type { ReactNode } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  return {
    title: { default: t("marketingTitle"), template: t("marketingTemplate") },
    description: t("marketingDescription"),
    openGraph: {
      type: "website",
      siteName: "AVAStudio",
      title: t("marketingTitle"),
      description: t("marketingDescription"),
      url: "https://avastudio.example",
    },
    twitter: { card: "summary_large_image", title: "AVAStudio" },
  };
}

export default function MarketingLayout({ children }: { children: ReactNode }): JSX.Element {
  const t = useTranslations("Marketing");
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="text-lg font-bold">
            AVAStudio
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/features" className="text-muted-foreground hover:text-foreground">
              {t("features")}
            </Link>
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
              {t("pricing")}
            </Link>
            <Link href="/signup" className="font-medium text-primary hover:underline">
              {t("start")}
            </Link>
            <LocaleSwitcher />
            <ThemeToggle />
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">
          {t("footer", { year: new Date().getFullYear() })}
        </div>
      </footer>
    </div>
  );
}
