/**
 * Настройки (Фаза 1) — профиль и предпочтения пользователя. In-memory (Фаза 2 — Postgres).
 */

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const LANGUAGES = ["ru", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

export interface Settings {
  displayName: string;
  email: string;
  language: Language;
  theme: Theme;
  defaultPlatform: string;
  emailNotifications: boolean;
}

export interface UpdateSettingsInput {
  displayName?: string | undefined;
  language?: Language | undefined;
  theme?: Theme | undefined;
  defaultPlatform?: string | undefined;
  emailNotifications?: boolean | undefined;
}

const DEFAULTS: Settings = {
  displayName: "Garnik",
  email: "nubaryan1@gmail.com",
  language: "ru",
  theme: "system",
  defaultPlatform: "tiktok",
  emailNotifications: true,
};

function store(): { current: Settings } {
  const g = globalThis as unknown as { __avsSettings?: { current: Settings } };
  if (!g.__avsSettings) g.__avsSettings = { current: { ...DEFAULTS } };
  return g.__avsSettings;
}

export function getSettings(): Settings {
  return { ...store().current };
}

export function updateSettings(input: UpdateSettingsInput): Settings {
  const s = store();
  s.current = {
    ...s.current,
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.language !== undefined ? { language: input.language } : {}),
    ...(input.theme !== undefined ? { theme: input.theme } : {}),
    ...(input.defaultPlatform !== undefined ? { defaultPlatform: input.defaultPlatform } : {}),
    ...(input.emailNotifications !== undefined ? { emailNotifications: input.emailNotifications } : {}),
  };
  return { ...s.current };
}
