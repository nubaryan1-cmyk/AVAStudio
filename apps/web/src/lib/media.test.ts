import { describe, expect, it } from "vitest";

import { createCaller } from "../server/routers/_app.js";

import { formatBytes, formatDuration, TYPE_LABELS } from "./media.js";

const caller = createCaller({});

describe("formatBytes/formatDuration", () => {
  it("форматирует размер", () => {
    expect(formatBytes(0)).toBe("0 Б");
    expect(formatBytes(820)).toBe("820 Б");
    expect(formatBytes(1024 * 1024)).toBe("1.0 МБ");
  });
  it("форматирует длительность", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(75)).toBe("1:15");
  });
});

describe("media router", () => {
  it("list возвращает сиды и фильтрует по типу", async () => {
    const all = await caller.media.list({});
    expect(all.length).toBeGreaterThan(0);
    const videos = await caller.media.list({ type: "video" });
    expect(videos.every((a) => a.type === "video")).toBe(true);
  });

  it("поиск по имени и тегам", async () => {
    const byName = await caller.media.list({ search: "teaser" });
    expect(byName.some((a) => a.name.includes("teaser"))).toBe(true);
    const byTag = await caller.media.list({ search: "promo" });
    expect(byTag.length).toBeGreaterThan(0);
  });

  it("фильтр по тегам (все должны совпасть)", async () => {
    const tagged = await caller.media.list({ tags: ["promo"] });
    expect(tagged.every((a) => a.tags.includes("promo"))).toBe(true);
  });

  it("upload видео проходит ffprobe-валидацию и сохраняется", async () => {
    const asset = await caller.media.upload({
      name: "new-clip.mp4",
      type: "video",
      sizeBytes: 5_000_000,
      durationSec: 20,
      width: 1080,
      height: 1920,
      fps: 30,
      tags: ["new"],
    });
    expect(asset.type).toBe("video");
    expect(asset.probe?.video?.width).toBe(1080);
    expect(asset.storagePath).toContain(asset.name);
  });

  it("upload видео сверх лимитов отклоняется", async () => {
    await expect(
      caller.media.upload({
        name: "too-long.mp4",
        type: "video",
        sizeBytes: 5_000_000,
        durationSec: 9999,
        width: 1080,
        height: 1920,
        fps: 30,
        tags: [],
      }),
    ).rejects.toThrow();
  });

  it("allTags возвращает отсортированный список", async () => {
    const tags = await caller.media.allTags();
    expect(tags).toContain("promo");
    expect([...tags]).toEqual([...tags].sort());
  });
});

describe("labels", () => {
  it("полны", () => {
    expect(TYPE_LABELS.video).toBeTruthy();
    expect(TYPE_LABELS.image).toBeTruthy();
    expect(TYPE_LABELS.audio).toBeTruthy();
  });
});
