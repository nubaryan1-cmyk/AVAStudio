import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
const UPLOADER = path.join("D:\\", "FFMPEG", "services", "uploader");
const VENV_PY = path.join(UPLOADER, "venv", "Scripts", "python.exe");
const SCRIPT = path.join(UPLOADER, "playwright_upload.py");
const CAPTION_FILE = path.join(UPLOADER, "caption.json");
const LIVE = path.join("D:\\", "FFMPEG", "panel", "public", "live");

export async function POST(req: Request): Promise<NextResponse> {
  const b = (await req.json().catch(() => null)) as
    | { login?: unknown; proxy?: unknown; caption?: unknown; hashtags?: unknown }
    | null;
  const login = typeof b?.login === "string" ? b.login.replace(/^@/, "") : "";
  const proxy = typeof b?.proxy === "string" ? b.proxy : "";
  const caption = typeof b?.caption === "string" ? b.caption : "";
  const hashtags = typeof b?.hashtags === "string" ? b.hashtags : "";
  if (!login) return NextResponse.json({ ok: false, error: "Сначала войдите в аккаунт" }, { status: 400 });

  // Дефолтная подпись/хэштеги — применяются к рилсам без своих.
  await fs.writeFile(CAPTION_FILE, JSON.stringify({ caption, hashtags }), "utf-8");
  await fs.mkdir(LIVE, { recursive: true });
  await fs.writeFile(path.join(LIVE, "status.json"),
    JSON.stringify({ active: true, stage: "starting", ts: new Date().toISOString() }), "utf-8");

  try {
    const proc = spawn(VENV_PY, [SCRIPT], {
      cwd: UPLOADER,
      env: { ...process.env, IG_USERNAME: login, IG_PROXY: proxy, BROWSER_HEADLESS: "true" },
      detached: true, stdio: "ignore",
    });
    proc.unref();
  } catch {
    return NextResponse.json({ ok: false, error: "Не удалось запустить заливку" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
