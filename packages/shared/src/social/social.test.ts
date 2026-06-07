import { describe, expect, it } from "vitest";

import { createMockPlatform } from "./mock.js";
import { createSocialRegistry, getPlatform } from "./registry.js";

import type { MediaRef, SocialAccountRef } from "./types.js";
import type { SocialAccountId } from "../domain/ids.js";

const ACCOUNT: SocialAccountRef = {
  accountId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" as SocialAccountId,
  platform: "instagram",
  handle: "@test",
};
const VIDEO: MediaRef = { kind: "video", path: "/tmp/v.mp4" };

describe("SocialPlatform абстракция (mock)", () => {
  it("login → постинг видео → PostResult ok", async () => {
    const ig = createMockPlatform({ platform: "instagram", capabilities: { mechanisms: ["phone", "browser"] } });
    const session = await ig.login(ACCOUNT);
    expect(session.mechanism).toBe("phone");
    const res = await ig.postVideo(session, VIDEO, { caption: "hi" });
    expect(res.ok).toBe(true);
    expect(res.platform).toBe("instagram");
    expect(res.externalPostId).toBeTruthy();
  });

  it("preferMechanism переопределяет механизм публикации", async () => {
    const ig = createMockPlatform({ capabilities: { mechanisms: ["phone", "browser"] } });
    const session = await ig.login(ACCOUNT);
    const res = await ig.postVideo(session, VIDEO, { preferMechanism: "browser" });
    expect(res.mechanism).toBe("browser");
  });

  it("failPosts → ok=false с причиной", async () => {
    const ig = createMockPlatform({ failPosts: true });
    const session = await ig.login(ACCOUNT);
    const res = await ig.postPhoto(session, { kind: "image", path: "/tmp/p.jpg" });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("сбой");
  });

  it("getStats нормализован", async () => {
    const stats = await createMockPlatform().getStats(ACCOUNT);
    expect(stats.followers).toBeGreaterThan(0);
    expect(stats.platform).toBe("instagram");
  });
});

describe("реестр платформ", () => {
  it("createSocialRegistry + getPlatform", () => {
    const reg = createSocialRegistry([
      createMockPlatform({ platform: "instagram" }),
      createMockPlatform({ platform: "tiktok" }),
    ]);
    expect(getPlatform(reg, "tiktok").platform).toBe("tiktok");
  });
  it("getPlatform бросает на незарегистрированной", () => {
    const reg = createSocialRegistry([]);
    expect(() => getPlatform(reg, "reddit")).toThrow(/не зарегистрирован/);
  });
});
