import { describe, expect, it, vi } from "vitest";

import { createCaller } from "../server/routers/_app.js";

import { PRESET_LABELS, presetLabel, statusLabel } from "./editor.js";

const caller = createCaller({});

async function firstVideoId(): Promise<string> {
  const videos = await caller.media.list({ type: "video" });
  const v = videos[0];
  if (!v) throw new Error("нет сид-видео");
  return v.id;
}

describe("editor labels", () => {
  it("полны и с фолбэком", () => {
    expect(PRESET_LABELS.brightness).toBeTruthy();
    expect(presetLabel("unknown_x")).toBe("unknown_x");
    expect(statusLabel("completed")).toBe("Готово");
  });
});

describe("editor router", () => {
  it("отдаёт пресеты и профили", async () => {
    const presets = await caller.editor.presets();
    const profiles = await caller.editor.profiles();
    expect(presets.some((p) => p.id === "brightness")).toBe(true);
    expect(profiles.some((p) => p.id === "tiktok")).toBe(true);
  });

  it("preview собирает ffmpeg-команду из выбранных пресетов (детерминированно по seed)", async () => {
    const id = await firstVideoId();
    const a = await caller.editor.preview({ sourceAssetId: id, presetIds: ["brightness", "speedUp"], seed: 42 });
    const b = await caller.editor.preview({ sourceAssetId: id, presetIds: ["brightness", "speedUp"], seed: 42 });
    expect(a.videoFilter).toContain("eq=brightness");
    expect(a.args).toContain("-vf");
    expect(a.args).toEqual(b.args);
  });

  it("preview отклоняет не-видео", async () => {
    const images = await caller.media.list({ type: "image" });
    const img = images[0];
    expect(img).toBeDefined();
    await expect(caller.editor.preview({ sourceAssetId: img!.id, presetIds: [] })).rejects.toThrow();
  });

  it("enqueue: пакет N×платформы; прогресс растёт и результат уходит в медиатеку", async () => {
    vi.useFakeTimers();
    try {
      const id = await firstVideoId();
      const before = (await caller.media.list({})).length;
      const { batchId, jobs } = await caller.editor.enqueue({
        sourceAssetId: id,
        presetIds: ["brightness", "crop"],
        profileIds: ["tiktok", "reddit"],
        variants: 3,
        seed: 7,
      });
      expect(jobs.length).toBe(6); // 3 варианта × 2 платформы
      expect(jobs.every((j) => j.progress === 0)).toBe(true);

      vi.advanceTimersByTime(5000); // > RENDER_MS (4с) → всё готово, <60с
      const done = await caller.editor.batch({ batchId });
      expect(done.every((j) => j.status === "completed")).toBe(true);
      expect(done.every((j) => j.resultAssetId !== null)).toBe(true);

      const after = (await caller.media.list({})).length;
      expect(after).toBe(before + 6);
      const uniquized = await caller.media.list({ tags: ["uniquized"] });
      expect(uniquized.length).toBeGreaterThanOrEqual(6);
    } finally {
      vi.useRealTimers();
    }
  });
});
