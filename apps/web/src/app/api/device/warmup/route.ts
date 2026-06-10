import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** warmup — Слой 2: постановка задачи воркеру (Amsterdam) через очередь. Пока заглушка. */
export async function POST(req: Request): Promise<NextResponse> {
  const b = (await req.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof b?.id === "string" ? b.id : "";
  if (!id) return NextResponse.json({ ok: false, error: "Не указан id телефона" }, { status: 400 });
  return NextResponse.json(
    { ok: false, error: "warmup: подключение воркера — Слой 2 (скоро)" },
    { status: 501 },
  );
}
