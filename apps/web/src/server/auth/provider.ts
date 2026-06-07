import { InMemoryUserStore, LocalAuthProvider } from "@avastudio/shared/auth";

/**
 * Серверный singleton аутентификации (Фаза 1, локально).
 * Хранилище пользователей — in-memory, живёт в процессе Node-сервера: регистрация
 * через /api/auth/signup persist'ит пользователя, /api/auth/login его находит.
 * Данные сбрасываются при перезапуске dev-сервера — это ожидаемо для Фазы 1.
 * В Фазе 2 store заменяется на Postgres-реализацию UserStore.
 */
const globalForAuth = globalThis as unknown as {
  __avsAuth?: { provider: LocalAuthProvider; store: InMemoryUserStore };
};

function build(): { provider: LocalAuthProvider; store: InMemoryUserStore } {
  const store = new InMemoryUserStore();
  const provider = new LocalAuthProvider({
    store,
    // eslint-disable-next-line no-process-env -- Фаза 1: секрет берётся из .env локально
    jwtSecret: process.env.AUTH_JWT_SECRET ?? "dev-insecure-jwt-secret-change-me-please",
  });
  return { provider, store };
}

export function getAuthProvider(): LocalAuthProvider {
  if (!globalForAuth.__avsAuth) {
    globalForAuth.__avsAuth = build();
  }
  return globalForAuth.__avsAuth.provider;
}
