import { exchangeCode, fetchTokenExchanger } from "@avastudio/shared/social";
import { NextResponse, type NextRequest } from "next/server";

/**
 * OAuth callback (TASK 20.2). Проверяет state, обменивает code на токены, передаёт
 * refresh_token на шифрование+сохранение (ЭТАП 2/3 — инфраструктурный слой).
 * Здесь сами токены наружу не отдаются.
 */
const STATE_COOKIE = "avs_oauth_state";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = req.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.json({ ok: false, error: "invalid oauth state" }, { status: 400 });
  }
  /* eslint-disable no-process-env */
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  /* eslint-enable no-process-env */
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ ok: false, error: "google oauth not configured" }, { status: 503 });
  }

  try {
    const tokens = await exchangeCode(fetchTokenExchanger, { code, clientId, clientSecret, redirectUri });
    // refresh_token шифруется DEK организации (encryptJSON) и сохраняется в social_accounts —
    // делает инфраструктурный слой (БД, ЭТАП 16). Здесь — только индикатор успеха.
    const res = NextResponse.redirect(new URL("/accounts?connected=youtube", url.origin));
    res.cookies.delete(STATE_COOKIE);
    void tokens; // токены передаются в защищённый слой сохранения, наружу не уходят
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "token exchange failed" }, { status: 502 });
  }
}
