import { describe, expect, it } from "vitest";

import { createCaller } from "../server/routers/_app.js";

import { isPrimeTime, postStatusLabel } from "./scheduling.js";

const caller = createCaller({});

describe("scheduling helpers", () => {
  it("прайм-тайм 18–22", () => {
    expect(isPrimeTime(19)).toBe(true);
    expect(isPrimeTime(22)).toBe(false);
    expect(isPrimeTime(9)).toBe(false);
    expect(postStatusLabel("posted")).toBe("Опубликован");
  });
});

describe("scheduling router", () => {
  it("accounts отдаёт лимиты anti-ban", async () => {
    const accounts = await caller.scheduling.accounts();
    expect(accounts.length).toBeGreaterThan(0);
    expect(accounts.every((a) => a.maxPostsPerDay > 0)).toBe(true);
  });

  it("posts: сиды есть, прошлые публикации разрешены (posted/failed)", async () => {
    const posts = await caller.scheduling.posts();
    expect(posts.length).toBeGreaterThan(0);
    const past = posts.filter((p) => new Date(p.scheduledAt).getTime() < Date.now() - 60_000);
    expect(past.every((p) => p.status === "posted" || p.status === "failed")).toBe(true);
  });

  it("schedule создаёт posting_job", async () => {
    const accounts = await caller.scheduling.accounts();
    const acc = accounts[0]!;
    const videos = await caller.media.list({ type: "video" });
    const asset = videos[0]!;
    const future = new Date(Date.now() + 3 * 86_400_000);
    future.setHours(20, 0, 0, 0);
    const post = await caller.scheduling.schedule({
      accountId: acc.id,
      assetId: asset.id,
      scheduledAt: future.toISOString(),
    });
    expect(post.status).toBe("scheduled");
    expect(post.accountHandle).toBe(acc.handle);
    expect(post.caption).toBeTruthy();
  });

  it("conflicts: вне прайм-тайма даёт подсказку", async () => {
    const accounts = await caller.scheduling.accounts();
    const acc = accounts[0]!;
    const morning = new Date(Date.now() + 86_400_000);
    morning.setHours(9, 0, 0, 0);
    const conflicts = await caller.scheduling.conflicts({
      accountId: acc.id,
      scheduledAt: morning.toISOString(),
    });
    expect(conflicts.some((c) => c.kind === "prime")).toBe(true);
  });

  it("reschedule переносит дату", async () => {
    const posts = await caller.scheduling.posts();
    const target = posts.find((p) => p.status === "scheduled") ?? posts[0]!;
    const moved = new Date(Date.now() + 5 * 86_400_000);
    moved.setHours(19, 0, 0, 0);
    const res = await caller.scheduling.reschedule({ id: target.id, scheduledAt: moved.toISOString() });
    expect(res.scheduledAt).toBe(moved.toISOString());
  });
});
