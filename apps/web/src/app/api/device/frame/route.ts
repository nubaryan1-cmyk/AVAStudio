import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";
const LIVE = path.join("D:\\", "FFMPEG", "panel", "public", "live");

export async function GET(): Promise<Response> {
  try {
    const buf = await fs.readFile(path.join(LIVE, "last.jpg"));
    return new Response(new Uint8Array(buf), {
      headers: { "content-type": "image/jpeg", "cache-control": "no-store" },
    });
  } catch {
    return new Response("no frame", { status: 404 });
  }
}
