import { ACCESS_COOKIE, isProtectedRoute, type RouteProtection } from "@avastudio/shared/auth/edge";
import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing.js";
import { getFlag } from "./lib/feature-flags.js";

/**
 * Middleware: i18n-роутинг (next-intl, локализованные URL /ru, /en, автоопределение
 * по Accept-Language) + защита приватных роутов (TASK 10.3). Сначала снимаем
 * локаль-префикс, проверяем доступ; неавторизованных редиректим на /<locale>/login.
 */

const PROTECTION: RouteProtection = {
  protectedPrefixes: ["/dashboard", "/studio", "/settings", "/billing"],
  publicPrefixes: ["/login", "/signup", "/api/auth"],
};

const intlMiddleware = createIntlMiddleware(routing);

/** Снимает префикс локали: "/ru/dashboard" → { locale: "ru", rest: "/dashboard" }. */
function stripLocale(pathname: string): { locale: string | null; rest: string } {
  const segments = pathname.split("/");
  const maybe = segments[1];
  if (maybe && (routing.locales as readonly string[]).includes(maybe)) {
    const rest = "/" + segments.slice(2).join("/");
    return { locale: maybe, rest: rest === "/" ? "/" : rest.replace(/\/$/, "") };
  }
  return { locale: null, rest: pathname };
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;
  const { locale, rest } = stripLocale(pathname);

  // Режим обслуживания (Edge Config feature flag). По умолчанию выключен.
  if (await getFlag("maintenanceMode")) {
    if (rest !== "/maintenance" && !rest.startsWith("/api")) {
      const url = req.nextUrl.clone();
      url.pathname = `/${locale ?? routing.defaultLocale}/maintenance`;
      return NextResponse.rewrite(url);
    }
  }

  if (isProtectedRoute(rest, PROTECTION)) {
    const hasSession = Boolean(req.cookies.get(ACCESS_COOKIE)?.value);
    if (!hasSession) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = `/${locale ?? routing.defaultLocale}/login`;
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(req);
}

export const config = {
  // Исключаем статику, _next и API из i18n-обработки.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
