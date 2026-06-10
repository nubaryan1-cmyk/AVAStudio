import { NextResponse } from "next/server";

import { initProxy, type ProxyConfig } from "@/server/duoplus/client";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<NextResponse> {
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof b?.id === "string" ? b.id : "";
  const host = typeof b?.host === "string" ? b.host : "";
  const port = Number(b?.port);
  if (!id || !host || !Number.isFinite(port)) {
    return NextResponse.json({ ok: false, error: "Укажите id, host и port прокси" }, { status: 400 });
  }
  const proxy: ProxyConfig = {
    protocol: typeof b?.protocol === "string" && b.protocol ? b.protocol : "socks5",
    host,
    port,
  };
  if (typeof b?.user === "string" && b.user) proxy.user = b.user;
  if (typeof b?.password === "string" && b.password) proxy.password = b.password;
  const ipScan = typeof b?.ipScan === "string" && b.ipScan ? b.ipScan : "ip2location";
  try {
    await initProxy(id, proxy, ipScan);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
