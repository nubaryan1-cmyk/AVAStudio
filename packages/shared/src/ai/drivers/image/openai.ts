/**
 * Реальный image-драйвер OpenAI `gpt-image-1` (TASK 21.1, активация каркаса 11.2).
 * Реализует ImageProvider — registry/fallback не меняются. HTTP-вызов через внедряемый
 * fetchImpl (в проде — глобальный fetch; в тестах — фейк). Без apiKey провайдер неактивен.
 */
import type { AiAsset, ImageProvider, ImageRequest, ImageResult } from "../../types.js";

export interface OpenAIImageConfig {
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_MODEL = "gpt-image-1";

interface OpenAIImageResponse {
  created?: number;
  data?: Array<{ url?: string; b64_json?: string }>;
}

function parseDims(size: string | undefined): { width: number; height: number } {
  const m = /^(\d+)x(\d+)$/.exec(size ?? "1024x1024");
  return { width: Number(m?.[1] ?? 1024), height: Number(m?.[2] ?? 1024) };
}

export function createOpenAIImageProvider(config: OpenAIImageConfig = {}): ImageProvider {
  const model = config.model ?? DEFAULT_MODEL;
  return {
    name: "openai-image",
    useCase: "image",
    async generateImage(req: ImageRequest): Promise<ImageResult> {
      if (config.apiKey === undefined || config.apiKey === "") {
        throw new Error("openai-image: API-ключ не настроен");
      }
      const fetchImpl = config.fetchImpl ?? fetch;
      const startedAt = Date.now();
      const { width, height } = parseDims(req.size);
      const res = await fetchImpl("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ model, prompt: req.prompt, size: req.size ?? "1024x1024", n: req.n ?? 1 }),
      });
      if (!res.ok) {
        throw new Error(`openai-image: HTTP ${res.status}`);
      }
      const json = (await res.json()) as OpenAIImageResponse;
      const items = json.data ?? [];
      if (items.length === 0) throw new Error("openai-image: пустой ответ");
      const images: AiAsset[] = items.map((d) => ({
        kind: "image" as const,
        url: d.url ?? (d.b64_json ? `data:image/png;base64,${d.b64_json}` : ""),
        mimeType: "image/png",
        width,
        height,
      }));
      return {
        images,
        meta: { provider: "openai-image", model, useCase: "image", latencyMs: Date.now() - startedAt },
      };
    },
  };
}
