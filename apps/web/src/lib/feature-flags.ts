/**
 * Feature flags (TASK 17.3). На Vercel читаются из Edge Config; локально/без
 * EDGE_CONFIG — безопасные дефолты, без падения и без жёсткой зависимости на пакет.
 *
 * Пакет @vercel/edge-config грузится ЛЕНИВО и только если задан EDGE_CONFIG,
 * с webpackIgnore — поэтому сборка не падает, когда пакет не установлен (dev/offline).
 */

export interface FeatureFlags {
  /** Режим обслуживания: закрывает приложение заглушкой. */
  maintenanceMode: boolean;
  /** Разрешена ли регистрация новых пользователей. */
  signupEnabled: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  maintenanceMode: false,
  signupEnabled: true,
};

/** Приводит сырое значение из Edge Config к типу дефолта (иначе — дефолт). */
export function resolveFlag<K extends keyof FeatureFlags>(
  key: K,
  raw: unknown,
): FeatureFlags[K] {
  const def = DEFAULT_FLAGS[key];
  return (typeof raw === typeof def ? (raw as FeatureFlags[K]) : def);
}

/** Читает один флаг. Нет EDGE_CONFIG / нет пакета / любая ошибка → дефолт. */
export async function getFlag<K extends keyof FeatureFlags>(key: K): Promise<FeatureFlags[K]> {
  if (!process.env.EDGE_CONFIG) {
    return DEFAULT_FLAGS[key];
  }
  try {
    const mod = (await import(/* webpackIgnore: true */ "@vercel/edge-config")) as {
      get: (k: string) => Promise<unknown>;
    };
    const raw = await mod.get(key as string);
    return resolveFlag(key, raw);
  } catch {
    return DEFAULT_FLAGS[key];
  }
}
