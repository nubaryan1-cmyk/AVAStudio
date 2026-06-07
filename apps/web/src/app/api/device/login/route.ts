import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Старый headless-аплоадер (Playwright, без эмулятора) — он логинится и стримит экран.
const UPLOADER = path.join("D:\\", "FFMPEG", "services", "uploader");
const VENV_PY = path.join(UPLOADER, "venv", "Scripts", "python.exe");
const LOGIN_SCRIPT = path.join(UPLOADER, "playwright_login.py");
const LIVE = path.join("D:\\", "FFMPEG", "panel", "public", "live");

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as
    | { login?: unknown; password?: unknown; proxy?: unknown }
    | null;
  const login = typeof body?.login === "string" ? body.login.replace(/^@/, "") : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const proxy = typeof body?.proxy === "string" ? body.proxy : "";
  if (!login || !password) {
    return NextResponse.json({ ok: false, error: "Укажите логин и пароль" }, { status: 400 });
  }

  await fs.mkdir(LIVE, { recursive: true });
  await fs.writeFile(
    path.join(LIVE, "status.json"),
    JSON.stringify({ active: true, stage: "starting", ts: new Date().toISOString() }),
    "utf-8",
  );

  try {
    const proc = spawn(VENV_PY, [LOGIN_SCRIPT], {
      cwd: UPLOADER,
      env: {
        ...process.env,
        IG_USERNAME: login,
        IG_PASSWORD: password,
        IG_PROXY: proxy,
        BROWSER_HEADLESS: "true",
      },
      detached: true,
      stdio: "ignore",
    });
    proc.unref();
  } catch {
    return NextResponse.json({ ok: false, error: "Не удалось запустить вход (нет venv?)" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
