import { randomUUID } from "node:crypto";

import { buildGoogleAuthUrl } from "@avastudio/shared/social";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Старт OAuth подключения YouTube-канала (TASK 20.2). Генерирует state (анти-CSRF),
 * кладёт в httpOnly cookie и редиректит на согласие Google.
 */
const STATE_COOKIE = "avs_oauth_state";

export function GET(_req: NextRequest): NextResponse {
  /* eslint-disable no-process-env */
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  /* eslint-enable no-process-env */
  if (!clientId || !redirectUri) {
    return NextResponse.json({ ok: false, error: "google oauth not configured" }, { status: 503 });
  }
  const state = randomUUID();
  const url = buildGoogleAuthUrl({ clientId, redirectUri, state });
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 600,
  });
  return res;
}
