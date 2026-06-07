"use client";

import { useEffect, useRef, useState } from "react";

import { Link, useRouter } from "@/i18n/navigation";

/**
 * Кружок аккаунта в правом верхнем углу. Открывает меню: тариф, настройки, выход.
 * Настройки переехали сюда из сайдбара.
 */
export function AccountMenu({ settingsLabel }: { settingsLabel: string }): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onDoc(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function logout(): Promise<void> {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Аккаунт"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90"
      >
        <PersonIcon />
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg border bg-background shadow-lg">
          <div className="border-b px-4 py-3">
            <p className="text-xs text-muted-foreground">Тариф</p>
            <p className="text-sm font-medium">Free</p>
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 text-sm hover:bg-accent"
          >
            {settingsLabel}
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="block w-full px-4 py-2.5 text-left text-sm text-destructive hover:bg-accent"
          >
            Выход
          </button>
        </div>
      ) : null}
    </div>
  );
}

function PersonIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}
