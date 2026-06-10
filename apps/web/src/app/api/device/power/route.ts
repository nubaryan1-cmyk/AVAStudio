import { NextResponse } from "next/server";

import { powerPhone } from "@/server/duoplus/client";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const b = (await req.json().catch(() => null)) as { id?: unknown; on?: unknown } | null;
  const id = typeof b?.id === "string" ? b.id : "";
  const on = Boolean(b?.on);
  if (!id) return NextResponse.json({ ok: false, error: "Не указан id телефона" }, { status: 400 });
  try {
    const res = await powerPhone(id, on);
    const failed = Array.isArray(res.fail) && res.fail.includes(id);
    if (failed) {
      const reason =
        (res.fail_reason && !Array.isArray(res.fail_reason) ? res.fail_reason[id] : undefined) ??
        (Array.isArray(res.fail_reason) ? res.fail_reason.join("; ") : undefined) ??
        "DuoPlus отклонил включение (проверьте баланс/лимит temporary-питания)";
      return NextResponse.json({ ok: false, error: reason }, { status: 502 });
    }
    return NextResponse.json({ ok: true, result: res });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
