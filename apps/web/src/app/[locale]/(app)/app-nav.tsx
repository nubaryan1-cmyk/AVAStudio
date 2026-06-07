"use client";

import { cn } from "@avastudio/ui";
import { useEffect, useState, type ReactNode } from "react";

import { Link, usePathname } from "@/i18n/navigation";

/** Пункт навигации. `match` — доп. префиксы маршрутов, при которых пункт-раздел
 *  считается активным (например «Монтаж» активен на /music, /uniqueizer, /editor). */
export type NavItem = { href: string; label: string; match?: ReadonlyArray<string> };

function matchesPrefix(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isActive(pathname: string, item: NavItem): boolean {
  if (matchesPrefix(pathname, item.href)) return true;
  return (item.match ?? []).some((m) => matchesPrefix(pathname, m));
}

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: ReadonlyArray<NavItem>;
  pathname: string;
  onNavigate?: () => void;
}): JSX.Element {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-primary font-medium text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppNav({
  items,
  brand,
  workspaceLabel,
  toolbar,
  children,
}: {
  items: ReadonlyArray<NavItem>;
  brand: string;
  workspaceLabel: string;
  toolbar: ReactNode;
  children: ReactNode;
}): JSX.Element {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Закрываем мобильное меню при смене маршрута.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="flex min-h-screen">
      {/* Десктопный сайдбар */}
      <aside className="hidden w-60 shrink-0 border-r bg-muted/20 md:block">
        <div className="px-6 py-5 text-lg font-bold">{brand}</div>
        <NavLinks items={items} pathname={pathname} />
      </aside>

      {/* Мобильный выезжающий drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Закрыть меню"
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-64 flex-col border-r bg-background shadow-xl">
            <div className="flex items-center justify-between px-6 py-5">
              <span className="text-lg font-bold">{brand}</span>
              <button
                type="button"
                aria-label="Закрыть"
                className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>
            <div className="overflow-y-auto pb-6">
              <NavLinks items={items} pathname={pathname} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Открыть меню"
              className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
              onClick={() => setOpen(true)}
            >
              <MenuIcon />
            </button>
            <span className="text-sm text-muted-foreground">{workspaceLabel}</span>
          </div>
          <div className="flex items-center gap-3">{toolbar}</div>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <div className="glow-panel h-full rounded-xl border p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function MenuIcon(): JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function CloseIcon(): JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  );
}
