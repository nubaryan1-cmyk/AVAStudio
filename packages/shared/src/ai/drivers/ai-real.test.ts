import { describe, expect, it } from "vitest";

import { buildAiRegistryFromEnv } from "../registry-from-env.js";

import { createElevenLabsProvider } from "./audio/elevenlabs.js";
import { createOpenAIImageProvider } from "./image/openai.js";
import { createRunwayVideoProvider } from "./video/runway.js";

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(body), arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) } as unknown as Response;
}

describe("AI real drivers (TASK 21.1)", () => {
  it("openai image: maps response to ImageResult", async () => {
    const fetchImpl = (() => Promise.resolve(jsonResponse({ data: [{ url: "https://img/1.png" }] }))) as unknown as typeof fetch;
    const p = createOpenAIImageProvider({ apiKey: "k", fetchImpl });
    const r = await p.generateImage({ prompt: "cat", size: "512x512" });
    expect(r.images[0]?.url).toBe("https://img/1.png");
    expect(r.meta.provider).toBe("openai-image");
  });

  it("openai image: throws without key", async () => {
    const p = createOpenAIImageProvider({});
    await expect(p.generateImage({ prompt: "x" })).rejects.toThrow();
  });

  it("runway: submit + poll succeeded", async () => {
    let call = 0;
    const fetchImpl = (() => {
      call += 1;
      return Promise.resolve(call === 1 ? jsonResponse({ id: "task_1" }) : jsonResponse({ status: "SUCCEEDED", output: ["https://v/1.mp4"] }));
    }) as unknown as typeof fetch;
    const p = createRunwayVideoProvider({ apiKey: "k", fetchImpl });
    const handle = await p.submitVideo({ prompt: "river" });
    expect(handle.jobId).toBe("task_1");
    const status = await p.pollVideo(handle.jobId);
    expect(status.state).toBe("succeeded");
    expect(status.video?.url).toBe("https://v/1.mp4");
  });

  it("elevenlabs: returns audio asset", async () => {
    const fetchImpl = (() => Promise.resolve(jsonResponse({}))) as unknown as typeof fetch;
    const p = createElevenLabsProvider({ apiKey: "k", fetchImpl });
    const r = await p.generateAudio({ text: "hello" });
    expect(r.audio.mimeType).toBe("audio/mpeg");
    expect(r.audio.bytes).toBe(4);
  });

  it("registry-from-env: real provider first when key present, mock fallback", () => {
    const reg = buildAiRegistryFromEnv({ OPENAI_API_KEY: "k" });
    expect(reg.image[0]?.name).toBe("openai-image");
    expect(reg.image[reg.image.length - 1]?.name).toBe("mock-image");
    const empty = buildAiRegistryFromEnv({});
    expect(empty.image).toHaveLength(1);
    expect(empty.image[0]?.name).toBe("mock-image");
  });
});
