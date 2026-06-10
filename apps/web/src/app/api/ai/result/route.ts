import { NextResponse } from "next/server";

import { falResult, falStatus } from "@/server/fal/client";

export const runtime = "nodejs";

/** Опрос статуса генерации fal; при COMPLETED возвращает результат. */
export async function POST(req: Request): Promise<NextResponse> {
  const b = (await req.json().catch(() => null)) as
    | { statusUrl?: unknown; responseUrl?: unknown }
    | null;
  const statusUrl = typeof b?.statusUrl === "string" ? b.statusUrl : "";
  const responseUrl = typeof b?.responseUrl === "string" ? b.responseUrl : "";
  if (!statusUrl || !responseUrl) {
    return NextResponse.json({ ok: false, error: "Нет URL задачи" }, { status: 400 });
  }
  try {
    const { status } = await falStatus(statusUrl);
    if (status === "COMPLETED") {
      const result = await falResult(responseUrl);
      return NextResponse.json({ ok: true, status, result });
    }
    return NextResponse.json({ ok: true, status });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
