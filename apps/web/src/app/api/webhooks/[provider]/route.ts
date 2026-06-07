import { handleWebhook } from "@avastudio/shared/payments";
import { NextResponse, type NextRequest } from "next/server";

import type { PaymentProvider as ProviderName } from "@avastudio/shared/domain";

import { getPayments } from "@/server/payments/provider";


/**
 * Платёжные webhooks (TASK 19.3). Единый роут для всех провайдеров:
 * `/api/webhooks/stripe`, `/api/webhooks/crypto`. Проверка подписи и нормализация —
 * внутри драйвера (parseWebhook); идемпотентность — в handleWebhook (по event.id).
 * Сырое тело читаем как text (подпись считается над сырым payload).
 */

const PROVIDERS = new Set<ProviderName>(["stripe", "crypto"]);

function signatureHeader(req: NextRequest, provider: string): string {
  if (provider === "stripe") return req.headers.get("stripe-signature") ?? "";
  return req.headers.get("x-nowpayments-sig") ?? req.headers.get("x-ipn-signature") ?? "";
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ provider: string }> },
): Promise<NextResponse> {
  const { provider } = await ctx.params;
  if (!PROVIDERS.has(provider as ProviderName)) {
    return NextResponse.json({ ok: false, error: "unknown provider" }, { status: 404 });
  }
  const payload = await req.text();
  const signature = signatureHeader(req, provider);

  try {
    const { registry, processed, subscriptions } = getPayments();
    const result = await handleWebhook(
      { registry, processed, subscriptions },
      provider as ProviderName,
      payload,
      signature,
    );
    // 200 даже на дубль — провайдер не должен ретраить уже обработанное.
    return NextResponse.json({ ok: true, applied: result.applied, type: result.event.type });
  } catch {
    // Невалидная подпись/неизвестное событие → 400, провайдер пометит как failed delivery.
    return NextResponse.json({ ok: false, error: "invalid webhook" }, { status: 400 });
  }
}
