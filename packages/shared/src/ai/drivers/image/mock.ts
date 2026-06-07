/**
 * Mock image-драйвер (Фаза 1, TASK 11.2). Возвращает плейсхолдер-ассеты + реалистичную
 * задержку — позволяет тестировать пайплайн без реального API/ключей. Реализует
 * ImageProvider (11.1). Реальный драйвер — ./openai.ts, активируется в Фазе 2.
 */
import type { ImageProvider, ImageRequest, ImageResult } from "../../types.js";

export interface MockImageOptions {
  name?: string;
  /** Имитация сетевой задержки, мс (0 в тестах). */
  delayMs?: number;
  /** Принудительный сбой — для проверки fallback chain. */
  fail?: boolean;
}

function parseDims(size: string | undefined): { width: number; height: number } {
  const match = /^(\d+)x(\d+)$/.exec(size ?? "1024x1024");
  return { width: Number(match?.[1] ?? 1024), height: Number(match?.[2] ?? 1024) };
}

const PLACEHOLDER_FIXTURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/** Создаёт mock image-провайдер. */
export function createMockImageProvider(options: MockImageOptions = {}): ImageProvider {
  const name = options.name ?? "mock-image";
  const delayMs = options.delayMs ?? 0;
  return {
    name,
    useCase: "image",
    async generateImage(req: ImageRequest): Promise<ImageResult> {
      const startedAt = Date.now();
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      if (options.fail === true) {
        throw new Error(`${name}: симулированный сбой провайдера`);
      }
      const { width, height } = parseDims(req.size);
      const count = req.n ?? 1;
      const images = Array.from({ length: count }, (_, i) => ({
        kind: "image" as const,
        url: i === 0 ? PLACEHOLDER_FIXTURE : `mock://image/${name}/${i}.png`,
        mimeType: "image/png",
        bytes: width * height,
        width,
        height,
      }));
      return {
        images,
        meta: { provider: name, model: `${name}-v1`, useCase: "image", latencyMs: Date.now() - startedAt },
      };
    },
  };
}
