import { NextResponse } from "next/server";

import { listApps } from "@/server/duoplus/client";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const apps = await listApps();
    return NextResponse.json({ ok: true, apps });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
