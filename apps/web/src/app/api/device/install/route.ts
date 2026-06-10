import { NextResponse } from "next/server";

import { installApp } from "@/server/duoplus/client";

export const runtime = "nodejs";

/** Установить любое приложение из каталога DuoPlus на телефон. */
export async function POST(req: Request): Promise<NextResponse> {
  const b = (await req.json().catch(() => null)) as
    | { id?: unknown; appId?: unknown; appVersionId?: unknown }
    | null;
  const id = typeof b?.id === "string" ? b.id : "";
  const appId = typeof b?.appId === "string" ? b.appId : "";
  const appVersionId = typeof b?.appVersionId === "string" ? b.appVersionId : undefined;
  if (!id || !appId) {
    return NextResponse.json({ ok: false, error: "Укажите id телефона и приложение" }, { status: 400 });
  }
  try {
    await installApp(id, appId, appVersionId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
