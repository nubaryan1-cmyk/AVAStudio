/**
 * Реальный video-драйвер Runway Gen-3 (TASK 21.1, активация каркаса 11.3). Async:
 * submitVideo создаёт задачу, pollVideo опрашивает статус (или приходит webhook 21.1).
 * Реализует VideoProvider; HTTP через внедряемый fetchImpl. Без ключа неактивен.
 */
import type { AiAsset, VideoJobHandle, VideoJobStatus, VideoProvider, VideoRequest } from "../../types.js";

export interface RunwayVideoConfig {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
}

const DEFAULT_MODEL = "gen3a_turbo";
const DEFAULT_BASE = "https://api.runwayml.com/v1";

interface RunwaySubmitResponse {
  id?: string;
}
interface RunwayTaskResponse {
  id?: string;
  status?: string;
  progress?: number;
  output?: string[];
  failure?: string;
}

function mapState(status: string | undefined): VideoJobStatus["state"] {
  switch (status) {
    case "SUCCEEDED":
      return "succeeded";
    case "FAILED":
      return "failed";
    case "RUNNING":
    case "THROTTLED":
      return "processing";
    default:
      return "queued";
  }
}

export function createRunwayVideoProvider(config: RunwayVideoConfig = {}): VideoProvider {
  const model = config.model ?? DEFAULT_MODEL;
  const base = config.baseUrl ?? DEFAULT_BASE;
  function ensureActive(): typeof fetch {
    if (config.apiKey === undefined || config.apiKey === "") {
      throw new Error("runway-video: API-ключ не настроен");
    }
    return config.fetchImpl ?? fetch;
  }
  const headers = (): Record<string, string> => ({
    authorization: `Bearer ${config.apiKey ?? ""}`,
    "content-type": "application/json",
  });
  return {
    name: "runway-video",
    useCase: "video",
    async submitVideo(req: VideoRequest): Promise<VideoJobHandle> {
      const f = ensureActive();
      const res = await f(`${base}/image_to_video`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ model, promptText: req.prompt, duration: req.durationSec ?? 5, ratio: req.aspectRatio }),
      });
      if (!res.ok) throw new Error(`runway-video: submit HTTP ${res.status}`);
      const json = (await res.json()) as RunwaySubmitResponse;
      if (!json.id) throw new Error("runway-video: нет id задачи");
      return { jobId: json.id, provider: "runway-video", state: "queued" };
    },
    async pollVideo(jobId: string): Promise<VideoJobStatus> {
      const f = ensureActive();
      const res = await f(`${base}/tasks/${jobId}`, { headers: headers() });
      if (!res.ok) throw new Error(`runway-video: poll HTTP ${res.status}`);
      const json = (await res.json()) as RunwayTaskResponse;
      const state = mapState(json.status);
      const status: VideoJobStatus = { jobId, state };
      if (typeof json.progress === "number") status.progress = json.progress;
      if (state === "succeeded" && json.output?.[0]) {
        const video: AiAsset = { kind: "video", url: json.output[0], mimeType: "video/mp4" };
        status.video = video;
        status.meta = { provider: "runway-video", model, useCase: "video", latencyMs: 0 };
      }
      if (state === "failed") status.error = json.failure ?? "runway failed";
      return status;
    },
  };
}
