import { selectActiveProvider } from "@avastudio/shared/payments";
import { NextResponse, type NextRequest } from "next/server";

import { getPayments } from "@/server/payments/provider";

import type { PaymentProvider as ProviderName } from "@avastudio/shared/domain";

/**
 * Customer Portal (TASK 19.4). Возвращает URL портала самообслуживания активного
 * провайдера. Карты (Stripe) — нативный Customer Portal (capability.portal=true).
 * Крипто — собственный портал (capability.portal=false) → отдаём внутренний роут.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as { provider?: string; customerId?: string };
  const { registry } = getPayments();
  const provider = selectActiveProvider(registry, body.provider as ProviderName | undefined);

  // Крипто и прочие без нативного портала → внутренняя страница истории invoice.
  if (!provider.capabilities.portal || !provider.createPortalSession) {
    return NextResponse.json({ ok: true, url: "/billing/invoices", native: false });
  }
  if (!body.customerId) {
    return NextResponse.json({ ok: false, error: "customerId required" }, { status: 400 });
  }
  try {
    const session = await provider.createPortalSession(body.customerId);
    return NextResponse.json({ ok: true, url: session.url, native: true });
  } catch {
    return NextResponse.json({ ok: false, error: "portal unavailable" }, { status: 502 });
  }
}
