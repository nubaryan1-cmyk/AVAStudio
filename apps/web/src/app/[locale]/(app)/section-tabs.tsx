"use client";

import { cn } from "@avastudio/ui";
import { useTranslations } from "next-intl";

import { Link, usePathname } from "@/i18n/navigation";

/**
 * Горизонтальная панель вкладок раздела, рендерится сверху рабочей области.
 * Каждый раздел сайдбара («Устройства» / «Монтаж» / «Автозалив») имеет свой
 * набор вкладок; активная вкладка получает glow-подсветку. Маршруты вкладок —
 * существующие страницы, поэтому переключение просто навигирует между ними.
 */
const SECTIONS = {
  devices: [
    { href: "/accounts", key: "accounts" },
    { href: "/proxies", key: "proxies" },
    { href: "/device-login", key: "cloudPhone" },
  ],
  editing: [
    { href: "/music", key: "music" },
    { href: "/uniqueizer", key: "uniqueizer" },
    { href: "/editor", key: "editor" },
  ],
  autopilot: [
    { href: "/warmup", key: "warmup" },
    { href: "/autopilot", key: "upload" },
    { href: "/calendar", key: "calendar" },
  ],
  generate: [
    { href: "/generate", key: "generation" },
    { href: "/media", key: "media" },
    { href: "/video", key: "video" },
  ],
} as const;

export type SectionKey = keyof typeof SECTIONS;

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SectionTabs({ section }: { section: SectionKey }): JSX.Element {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const tabs = SECTIONS[section];

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2 border-b pb-3">
      {tabs.map((tab) => {
        const active = isActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-4 py-2 text-sm transition-colors",
              active
                ? "bg-primary font-medium text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </div>
  );
}
