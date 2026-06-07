import { ACCESS_COOKIE } from "@avastudio/shared/auth/edge";
import { NextResponse } from "next/server";

export function POST(): NextResponse {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
