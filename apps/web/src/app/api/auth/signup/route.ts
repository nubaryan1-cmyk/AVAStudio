import { AppError } from "@avastudio/shared";
import { ACCESS_COOKIE } from "@avastudio/shared/auth/edge";
import { fetchTurnstileVerifier, verifyTurnstile } from "@avastudio/shared/captcha";
import { NextResponse } from "next/server";

import { getAuthProvider } from "@/server/auth/provider";

const ACCESS_TTL_SEC = 60 * 60;

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as
    | { email?: unknown; password?: unknown; turnstileToken?: unknown }
    | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const turnstileToken = typeof body?.turnstileToken === "string" ? body.turnstileToken : null;

  // eslint-disable-next-line no-process-env
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const captchaOk = await verifyTurnstile(
    fetchTurnstileVerifier,
    {
      token: turnstileToken,
      secret,
      ...(req.headers.get("x-forwarded-for") ? { remoteIp: req.headers.get("x-forwarded-for") as string } : {}),
    },
    // CAPTCHA обязательна только когда настроен ключ Turnstile; иначе — пропуск.
    Boolean(secret),
  );
  if (!captchaOk) {
    return NextResponse.json({ ok: false, error: "Проверка CAPTCHA не пройдена" }, { status: 400 });
  }

  try {
    const session = await (await getAuthProvider()).signUp({ email, password });
    const res = NextResponse.json({ ok: true, email: session.user.email });
    res.cookies.set(ACCESS_COOKIE, session.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ACCESS_TTL_SEC,
    });
    return res;
  } catch (err) {
    const message = err instanceof AppError ? err.userMessage : "Не удалось зарегистрироваться";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
