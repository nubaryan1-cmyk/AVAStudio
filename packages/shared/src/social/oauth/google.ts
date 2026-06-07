/**
 * Google OAuth 2.0 хелперы для подключения YouTube-каналов (TASK 20.2).
 * Чистые функции (URL/обмен через порт) — тестируемы без сети. Реальный обмен кода
 * на токены делает порт TokenExchanger (в проде — fetch к oauth2.googleapis.com).
 * refresh_token шифруется вызывающим кодом (ЭТАП 2/3) перед сохранением.
 */

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
] as const;

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

export interface GoogleAuthUrlOptions {
  clientId: string;
  redirectUri: string;
  /** Анти-CSRF state (привязывается к сессии пользователя). */
  state: string;
  scopes?: readonly string[];
}

/** Строит URL согласия Google. access_type=offline+prompt=consent → выдаётся refresh_token. */
export function buildGoogleAuthUrl(opts: GoogleAuthUrlOptions): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: (opts.scopes ?? YOUTUBE_SCOPES).join(" "),
    state: opts.state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export interface GoogleTokens {
  accessToken: string;
  refreshToken?: string;
  expiresInSec: number;
  scope?: string;
  tokenType?: string;
}

/** Порт обмена authorization code на токены (в проде — POST oauth2.googleapis.com/token). */
export interface TokenExchanger {
  exchange(input: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }): Promise<GoogleTokens>;
}

/** Обмен кода на токены через порт. Возвращает нормализованные токены. */
export async function exchangeCode(
  exchanger: TokenExchanger,
  input: { code: string; clientId: string; clientSecret: string; redirectUri: string },
): Promise<GoogleTokens> {
  const tokens = await exchanger.exchange(input);
  if (!tokens.accessToken) {
    throw new Error("google oauth: пустой access_token");
  }
  return tokens;
}

/** Реальный обменник через fetch (Фаза 2; в тестах подменяется фейком). */
export const fetchTokenExchanger: TokenExchanger = {
  async exchange(input): Promise<GoogleTokens> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: input.code,
        client_id: input.clientId,
        client_secret: input.clientSecret,
        redirect_uri: input.redirectUri,
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!res.ok) throw new Error(`google token exchange failed: ${res.status}`);
    const j = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
      token_type?: string;
    };
    return {
      accessToken: j.access_token,
      ...(j.refresh_token ? { refreshToken: j.refresh_token } : {}),
      expiresInSec: j.expires_in,
      ...(j.scope ? { scope: j.scope } : {}),
      ...(j.token_type ? { tokenType: j.token_type } : {}),
    };
  },
};
