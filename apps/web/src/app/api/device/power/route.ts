import { NextResponse } from "next/server";

import { powerPhone } from "@/server/duoplus/client";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const b = (await req.json().catch(() => null)) as { id?: unknown; on?: unknown } | null;
  const id = typeof b?.id === "string" ? b.id : "";
  const on = Boolean(b?.on);
  if (!id) return NextResponse.json({ ok: false, error: "Не указан id телефона" }, { status: 400 });
  try {
    await powerPhone(id, on);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
