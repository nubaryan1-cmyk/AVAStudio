import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
const UPLOADER = path.join("D:\\", "FFMPEG", "services", "uploader");
const VENV_PY = path.join(UPLOADER, "venv", "Scripts", "python.exe");
const SCRIPT = path.join(UPLOADER, "warmup_loop.py");
const LIVE = path.join("D:\\", "FFMPEG", "panel", "public", "live");

export async function POST(req: Request): Promise<NextResponse> {
  const b = (await req.json().catch(() => null)) as
    | { login?: unknown; proxy?: unknown; hashtags?: unknown; note?: unknown }
    | null;
  const login = typeof b?.login === "string" ? b.login.replace(/^@/, "") : "";
  const proxy = typeof b?.proxy === "string" ? b.proxy : "";
  const hashtags = typeof b?.hashtags === "string" ? b.hashtags : "";
  const note = typeof b?.note === "string" ? b.note : "";
  if (!login) return NextResponse.json({ ok: false, error: "Сначала войдите в аккаунт" }, { status: 400 });

  await fs.mkdir(LIVE, { recursive: true });
  await fs.writeFile(path.join(LIVE, "status.json"),
    JSON.stringify({ active: true, stage: "starting", ts: new Date().toISOString() }), "utf-8");

  try {
    const proc = spawn(VENV_PY, [SCRIPT], {
      cwd: UPLOADER,
      env: { ...process.env, IG_USERNAME: login, IG_PROXY: proxy,
             WARMUP_HASHTAGS: hashtags, WARMUP_NOTE: note, BROWSER_HEADLESS: "true",
             WARMUP_HOURS: "24", SESSION_GAP_MIN: "30", SESSION_GAP_MAX: "150" },
      detached: true, stdio: "ignore",
    });
    proc.unref();
  } catch {
    return NextResponse.json({ ok: false, error: "Не удалось запустить прогрев" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
