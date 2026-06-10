import { NextResponse } from "next/server";

import { falSubmit } from "@/server/fal/client";

export const runtime = "nodejs";

/** Ставит генерацию (фото/видео/озвучка) в очередь fal.ai. */
export async function POST(req: Request): Promise<NextResponse> {
  const b = (await req.json().catch(() => null)) as
    | { model?: unknown; prompt?: unknown; extra?: unknown }
    | null;
  const model = typeof b?.model === "string" ? b.model : "";
  const prompt = typeof b?.prompt === "string" ? b.prompt : "";
  if (!model || !prompt.trim()) {
    return NextResponse.json({ ok: false, error: "Укажите модель и промт" }, { status: 400 });
  }
  const extra = (b?.extra && typeof b.extra === "object" ? b.extra : {}) as Record<string, unknown>;
  try {
    const r = await falSubmit(model, { prompt, ...extra });
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
