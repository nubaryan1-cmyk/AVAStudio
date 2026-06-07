import { describe, expect, it } from "vitest";

import { createLumaVideoProvider, createMockVideoProvider, createRunwayVideoProvider } from "./index.js";

describe("mock video driver (async)", () => {
  it("submit→poll: queued → processing → succeeded", async () => {
    const provider = createMockVideoProvider({ pollsUntilReady: 3 });
    const handle = await provider.submitVideo({ prompt: "ocean", durationSec: 8 });
    expect(handle.state).toBe("queued");
    const p1 = await provider.pollVideo(handle.jobId);
    expect(p1.state).toBe("processing");
    expect(p1.progress).toBeCloseTo(1 / 3);
    await provider.pollVideo(handle.jobId);
    const p3 = await provider.pollVideo(handle.jobId);
    expect(p3.state).toBe("succeeded");
    expect(p3.video?.durationSec).toBe(8);
    expect(p3.progress).toBe(1);
  });

  it("poll неизвестного job → failed", async () => {
    const status = await createMockVideoProvider().pollVideo("nope");
    expect(status.state).toBe("failed");
  });

  it("fail:true → submit бросает", async () => {
    await expect(createMockVideoProvider({ fail: true }).submitVideo({ prompt: "x" })).rejects.toThrow();
  });
});

describe("каркасы реальных драйверов (Фаза 2)", () => {
  it("runway без ключа неактивен", async () => {
    await expect(createRunwayVideoProvider().submitVideo({ prompt: "x" })).rejects.toThrow(/ключ/);
  });
  it("luma без ключа неактивен", async () => {
    await expect(createLumaVideoProvider().submitVideo({ prompt: "x" })).rejects.toThrow(/ключ/);
  });
});
