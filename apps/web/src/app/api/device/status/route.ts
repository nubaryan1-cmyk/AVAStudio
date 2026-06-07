import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Экран пишет старый Playwright-аплоадер сюда:
const LIVE = path.join("D:\\", "FFMPEG", "panel", "public", "live");

export async function GET(): Promise<NextResponse> {
  try {
    const raw = await fs.readFile(path.join(LIVE, "status.json"), "utf-8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ active: false, stage: "idle" });
  }
}
