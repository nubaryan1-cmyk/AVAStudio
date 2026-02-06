import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gatewayUrl = process.env.GATEWAY_URL;
  if (!gatewayUrl) return NextResponse.json({ ok: false, error: "missing_gateway_url" }, { status: 500 });

  const auth = req.headers.get("authorization") || "";
  const hasBearer = auth.toLowerCase().startsWith("bearer ");
  if (!hasBearer) {
    return NextResponse.json(
      { ok: false, error: "missing_authorization", required: "Authorization: Bearer <access_token>" },
      { status: 401 }
    );
  }

  const upstream = await fetch(`${gatewayUrl}/api/v1/auth/me`, {
    method: "GET",
    headers: { authorization: auth },
  });

  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") || "application/json" },
  });
}
