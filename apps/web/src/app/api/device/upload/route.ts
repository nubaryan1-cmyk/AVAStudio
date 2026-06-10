import { enqueue } from "@avastudio/queue";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** upload (Слой 2): ставит задачу phone-task воркеру (Amsterdam) через Upstash Redis. */
export async function POST(req: Request): Promise<NextResponse> {
  const b = (await req.json().catch(() => null)) as
    | { id?: unknown; caption?: unknown; assetUrl?: unknown }
    | null;
  const id = typeof b?.id === "string" ? b.id : "";
  if (!id) return NextResponse.json({ ok: false, error: "Не указан id телефона" }, { status: 400 });
  const caption = typeof b?.caption === "string" ? b.caption : undefined;
  const assetUrl = typeof b?.assetUrl === "string" ? b.assetUrl : undefined;
  try {
    const job = await enqueue(
      "phone-task",
      { imageId: id, kind: "upload", ...(caption ? { caption } : {}), ...(assetUrl ? { assetUrl } : {}) },
      { jobId: `phone-upload-${id}-${Date.now()}` },
    );
    return NextResponse.json({ ok: true, jobId: job.id });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
