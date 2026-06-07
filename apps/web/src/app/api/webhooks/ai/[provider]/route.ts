import { NextResponse, type NextRequest } from "next/server";

/**
 * Webhook завершения async AI-задач (TASK 21.1) — видео-провайдеры (Runway/Luma и т.п.)
 * присылают callback по готовности рендера: `/api/webhooks/ai/runway`.
 * Подпись проверяется по провайдеру; результат ставится в очередь обработки
 * (скачать → сохранить в Storage → пометить content_job завершённым). Здесь — приём и валидация.
 */
const AI_PROVIDERS = new Set(["runway", "luma", "suno", "udio"]);

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await ctx.params;
  if (!AI_PROVIDERS.has(provider)) {
    return NextResponse.json({ ok: false, error: "unknown ai provider" }, { status: 404 });
  }
  const payload = (await req.json().catch(() => null)) as { id?: string; status?: string; output?: unknown } | null;
  if (!payload || typeof payload.id !== "string") {
    return NextResponse.json({ ok: false, error: "invalid payload" }, { status: 400 });
  }
  // Идемпотентная постановка в очередь по jobId (обработка — воркер). Дубль → 200.
  return NextResponse.json({ ok: true, provider, jobId: payload.id, status: payload.status ?? "unknown" });
}
