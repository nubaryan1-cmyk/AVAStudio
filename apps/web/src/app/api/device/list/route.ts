import { NextResponse } from "next/server";

import { listPhones } from "@/server/duoplus/client";

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  try {
    const phones = await listPhones();
    return NextResponse.json({ ok: true, phones });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
