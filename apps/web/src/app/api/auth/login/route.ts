import { AppError } from "@avastudio/shared";
import { ACCESS_COOKIE } from "@avastudio/shared/auth/edge";
import { NextResponse } from "next/server";

import { getAuthProvider } from "@/server/auth/provider";

const ACCESS_TTL_SEC = 60 * 60;

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as
    | { email?: unknown; password?: unknown }
    | null;
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  try {
    const session = await getAuthProvider().signIn({ email, password });
    const res = NextResponse.json({ ok: true, email: session.user.email });
    res.cookies.set(ACCESS_COOKIE, session.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ACCESS_TTL_SEC,
    });
    return res;
  } catch (err) {
    const message = err instanceof AppError ? err.userMessage : "Неверный email или пароль";
    return NextResponse.json({ ok: false, error: message }, { status: 401 });
  }
}
