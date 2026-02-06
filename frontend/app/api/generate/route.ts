import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const gatewayUrl = process.env.GATEWAY_URL;
  if (!gatewayUrl) return NextResponse.json({ error: "missing_gateway_url" }, { status: 500 });

  const auth = req.headers.get("authorization") || "";
  const hasBearer = auth.toLowerCase().startsWith("bearer ");
  if (!hasBearer) {
    return NextResponse.json(
      { error: "missing_authorization", required: "Authorization: Bearer <access_token>" },
      { status: 401 }
    );
  }

  const body = await req.text();

  const upstream = await fetch(`${gatewayUrl}/api/v1/photo/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: auth,
    },
    body,
  });

  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": upstream.headers.get("content-type") || "application/json" },
  });
}
