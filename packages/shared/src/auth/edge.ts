/**
 * Edge-safe подмножество auth (ЭТАП 10). НЕ импортирует node:crypto/bcrypt — пригодно
 * для Next middleware (Edge runtime) и любых сред без Node API. Здесь только чистая
 * логика маршрутов и имена cookie; криптография — в session.ts/jwt.ts (Node).
 */

/** Имя cookie с access-токеном сессии. */
export const ACCESS_COOKIE = "avs_access";
/** Имя cookie с refresh-токеном сессии. */
export const REFRESH_COOKIE = "avs_refresh";

/** Список путей, требующих авторизации, и публичных исключений (для middleware). */
export interface RouteProtection {
  /** Префиксы защищённых путей. */
  protectedPrefixes: string[];
  /** Префиксы-исключения (публичные), даже если попадают под protected. */
  publicPrefixes?: string[];
}

/** Чистая проверка: требует ли путь авторизации. */
export function isProtectedRoute(pathname: string, cfg: RouteProtection): boolean {
  if (cfg.publicPrefixes?.some((p) => pathname.startsWith(p))) return false;
  return cfg.protectedPrefixes.some((p) => pathname.startsWith(p));
}
