import { NextResponse } from "next/server";

import { findInstagram, installApp } from "@/server/duoplus/client";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const b = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof b?.id === "string" ? b.id : "";
  if (!id) return NextResponse.json({ ok: false, error: "Укажите id телефона" }, { status: 400 });
  try {
    const ig = await findInstagram();
    if (!ig) {
      return NextResponse.json(
        { ok: false, error: "Instagram не найден в каталоге DuoPlus. Установите его через Play Store на телефоне." },
        { status: 404 },
      );
    }
    await installApp(id, ig.id, ig.version_list?.[0]?.id);
    return NextResponse.json({ ok: true, app: { name: ig.name, pkg: ig.pkg, version: ig.version_list?.[0]?.name ?? "" } });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
