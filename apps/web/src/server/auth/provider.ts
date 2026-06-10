import {
  InMemoryUserStore,
  LocalAuthProvider,
  createSupabaseAuthProvider,
  type AuthProvider,
} from "@avastudio/shared/auth";

/**
 * Серверный singleton аутентификации.
 * - AUTH_PROVIDER=supabase + SUPABASE_URL/SUPABASE_ANON_KEY → боевой Supabase Auth (ЭТАП 16.3),
 *   пользователи хранятся в Supabase, переживают рестарты/деплои (serverless-safe).
 * - иначе → локальный in-memory провайдер (Фаза 1, для dev; данные сбрасываются).
 */
const globalForAuth = globalThis as unknown as {
  __avsAuthProvider?: Promise<AuthProvider>;
};

async function build(): Promise<AuthProvider> {
  /* eslint-disable no-process-env */
  const mode = process.env.AUTH_PROVIDER;
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const jwtSecret = process.env.AUTH_JWT_SECRET ?? "dev-insecure-jwt-secret-change-me-please";
  /* eslint-enable no-process-env */

  if (mode === "supabase" && url && anonKey) {
    return createSupabaseAuthProvider(url, anonKey);
  }
  return new LocalAuthProvider({ store: new InMemoryUserStore(), jwtSecret });
}

export function getAuthProvider(): Promise<AuthProvider> {
  if (!globalForAuth.__avsAuthProvider) {
    globalForAuth.__avsAuthProvider = build();
  }
  return globalForAuth.__avsAuthProvider;
}
