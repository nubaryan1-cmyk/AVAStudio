import { createElevenLabsProvider } from "./drivers/audio/elevenlabs.js";
import { createMockTtsProvider, createMockMusicProvider } from "./drivers/audio/mock.js";
import { createSunoProvider } from "./drivers/audio/suno.js";
import { createMockImageProvider } from "./drivers/image/mock.js";
import { createOpenAIImageProvider } from "./drivers/image/openai.js";
import { createReplicateImageProvider } from "./drivers/image/replicate.js";
import { createLumaVideoProvider } from "./drivers/video/luma.js";
import { createMockVideoProvider } from "./drivers/video/mock.js";
import { createRunwayVideoProvider } from "./drivers/video/runway.js";
import { createRegistry, type AiProviderRegistry } from "./registry.js";

/**
 * Сборка боевого AI-реестра из env (TASK 21.1/21.2). На каждый use-case — цепочка
 * реальных провайдеров (fallback по порядку), затем mock как последний резерв.
 * Реальный провайдер добавляется в цепочку только при наличии ключа — иначе он
 * неактивен и его пропускаем (mock гарантирует, что генерация не падает в dev).
 */

export interface AiEnvKeys {
  OPENAI_API_KEY?: string | undefined;
  REPLICATE_API_TOKEN?: string | undefined;
  RUNWAY_API_KEY?: string | undefined;
  LUMA_API_KEY?: string | undefined;
  ELEVENLABS_API_KEY?: string | undefined;
  CARTESIA_API_KEY?: string | undefined;
  SUNO_API_KEY?: string | undefined;
  UDIO_API_KEY?: string | undefined;
}

const has = (v: string | undefined): v is string => v !== undefined && v.trim() !== "";

export function buildAiRegistryFromEnv(env: AiEnvKeys): AiProviderRegistry {
  return createRegistry({
    image: [
      ...(has(env.OPENAI_API_KEY) ? [createOpenAIImageProvider({ apiKey: env.OPENAI_API_KEY })] : []),
      ...(has(env.REPLICATE_API_TOKEN) ? [createReplicateImageProvider({ apiToken: env.REPLICATE_API_TOKEN })] : []),
      createMockImageProvider({ name: "mock-image" }),
    ],
    video: [
      ...(has(env.RUNWAY_API_KEY) ? [createRunwayVideoProvider({ apiKey: env.RUNWAY_API_KEY })] : []),
      ...(has(env.LUMA_API_KEY) ? [createLumaVideoProvider({ apiKey: env.LUMA_API_KEY })] : []),
      createMockVideoProvider({ name: "mock-video" }),
    ],
    audio: [
      ...(has(env.ELEVENLABS_API_KEY) ? [createElevenLabsProvider({ apiKey: env.ELEVENLABS_API_KEY })] : []),
      createMockTtsProvider({ name: "mock-tts" }),
    ],
    music: [
      ...(has(env.SUNO_API_KEY) ? [createSunoProvider({ apiKey: env.SUNO_API_KEY })] : []),
      createMockMusicProvider({ name: "mock-music" }),
    ],
  });
}
