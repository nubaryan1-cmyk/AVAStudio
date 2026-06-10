import { ThemeToggle } from "@avastudio/ui";
import { useTranslations } from "next-intl";

import { AppNav, type NavItem } from "./app-nav";
import { Providers } from "./providers";

import type { ReactNode } from "react";

import { LocaleSwitcher } from "@/components/locale-switcher";
import { AccountMenu } from "./account-menu";



/**
 * Плоский список разделов сайдбара. Разделы с под-вкладками («Устройства»,
 * «Монтаж», «Автозалив») ведут на первую вкладку, а `match` подсвечивает
 * пункт активным на любом из маршрутов раздела. Под-вкладки рендерит
 * SectionTabs сверху рабочей области.
 */
const NAV: ReadonlyArray<{ href: string; key: string; match?: ReadonlyArray<string> }> = [
  { href: "/dashboard", key: "dashboard" },
  { href: "/personas", key: "personas" },
  { href: "/generate", key: "generate", match: ["/media", "/video"] },
  { href: "/music", key: "editing", match: ["/uniqueizer", "/editor"] },
  { href: "/accounts", key: "devices", match: ["/proxies", "/device-login"] },
  { href: "/autopilot", key: "autopilot", match: ["/calendar", "/warmup"] },
];

export default function AppLayout({ children }: { children: ReactNode }): JSX.Element {
  const t = useTranslations("Nav");

  const items: NavItem[] = NAV.map((entry) => ({
    href: entry.href,
    label: t(entry.key),
    ...(entry.match ? { match: entry.match } : {}),
  }));

  return (
    <Providers>
      <AppNav
        items={items}
        brand="AVAStudio"
        workspaceLabel={t("workspace")}
        toolbar={
          <>
            <LocaleSwitcher />
            <ThemeToggle />
            <AccountMenu settingsLabel={t("settings")} billingLabel={t("billing")} />
          </>
        }
      >
        {children}
      </AppNav>
    </Providers>
  );
}
