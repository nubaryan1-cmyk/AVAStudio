/**
 * Cloudflare Turnstile серверная валидация (TASK 23.3). Проверяет токен виджета на
 * /signup, /login (после неудач), /contact перед обработкой формы. HTTP через порт
 * (в тестах — фейк). Без секрета — режим "disabled" (в dev пропускаем, в prod настраивается).
 */
export interface TurnstileVerifyResult {
  success: boolean;
  errorCodes?: string[];
}

export interface TurnstileVerifier {
  verify(input: { token: string; secret: string; remoteIp?: string }): Promise<TurnstileVerifyResult>;
}

/** Реальный верификатор через siteverify (Фаза 2). */
export const fetchTurnstileVerifier: TurnstileVerifier = {
  async verify(input): Promise<TurnstileVerifyResult> {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: input.secret,
        response: input.token,
        ...(input.remoteIp ? { remoteip: input.remoteIp } : {}),
      }).toString(),
    });
    if (!res.ok) return { success: false, errorCodes: [`http_${res.status}`] };
    const j = (await res.json()) as { success: boolean; "error-codes"?: string[] };
    return { success: j.success, ...(j["error-codes"] ? { errorCodes: j["error-codes"] } : {}) };
  },
};

/**
 * Валидирует Turnstile-токен. Если secret пуст (не настроен) — возвращает allowed по
 * флагу requireWhenUnconfigured (в проде true → блок, в dev false → пропуск).
 */
export async function verifyTurnstile(
  verifier: TurnstileVerifier,
  input: { token: string | null | undefined; secret: string | undefined; remoteIp?: string },
  requireWhenUnconfigured = false,
): Promise<boolean> {
  if (!input.secret || input.secret === "") {
    return !requireWhenUnconfigured;
  }
  if (!input.token || input.token === "") return false;
  const result = await verifier.verify({
    token: input.token,
    secret: input.secret,
    ...(input.remoteIp ? { remoteIp: input.remoteIp } : {}),
  });
  return result.success;
}
