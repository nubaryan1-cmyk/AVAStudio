import { screenshot } from "@/server/duoplus/client";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) return new Response("no id", { status: 400 });
  try {
    const b64 = await screenshot(id);
    const buf = Buffer.from(b64, "base64");
    return new Response(new Uint8Array(buf), {
      headers: { "content-type": "image/png", "cache-control": "no-store" },
    });
  } catch (err) {
    return new Response(err instanceof Error ? err.message : "frame error", { status: 502 });
  }
}
