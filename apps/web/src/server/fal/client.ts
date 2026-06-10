/** Тонкий serverless-клиент fal.ai (очередь). Ключ FAL_KEY из Doppler/env. */
const QUEUE = "https://queue.fal.run";

function key(): string {
  // eslint-disable-next-line no-process-env
  const k = process.env.FAL_KEY;
  if (!k) throw new Error("FAL_KEY не задан");
  return k;
}

export interface FalSubmit {
  request_id: string;
  status_url: string;
  response_url: string;
}

/** Ставит задачу генерации в очередь fal. model — путь вида "fal-ai/nano-banana". */
export async function falSubmit(model: string, input: Record<string, unknown>): Promise<FalSubmit> {
  const res = await fetch(`${QUEUE}/${model}`, {
    method: "POST",
    headers: { Authorization: `Key ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const j = (await res.json().catch(() => ({}))) as Partial<FalSubmit> & { detail?: unknown };
  if (!res.ok || !j.request_id || !j.status_url || !j.response_url) {
    throw new Error(`fal submit ${model}: ${res.status} ${JSON.stringify(j.detail ?? j).slice(0, 300)}`);
  }
  return { request_id: j.request_id, status_url: j.status_url, response_url: j.response_url };
}

/** Только URL очереди fal — защита от обращения к произвольным адресам. */
function assertFalUrl(u: string): void {
  if (!u.startsWith("https://queue.fal.run/")) throw new Error("Недопустимый URL fal");
}

export async function falStatus(statusUrl: string): Promise<{ status: string }> {
  assertFalUrl(statusUrl);
  const res = await fetch(statusUrl, { headers: { Authorization: `Key ${key()}` } });
  const j = (await res.json().catch(() => ({}))) as { status?: string };
  return { status: j.status ?? "UNKNOWN" };
}

export async function falResult(responseUrl: string): Promise<unknown> {
  assertFalUrl(responseUrl);
  const res = await fetch(responseUrl, { headers: { Authorization: `Key ${key()}` } });
  return res.json().catch(() => ({}));
}
