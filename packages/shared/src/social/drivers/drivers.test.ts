import { describe, expect, it } from "vitest";

import { generateDataKey } from "../../credentials/index.js";
import { asOrgId, asSocialAccountId } from "../../domain/ids.js";
import { createDuoPlusMock } from "../../phones/drivers/duoplus-mock.js";
import { PhonePool } from "../../phones/pool.js";
import { createMockProxyProvider } from "../../proxies/drivers/mock.js";
import { ProxyManager } from "../../proxies/manager.js";
import { InMemoryProxyRepository } from "../../proxies/repo.js";
import { createSocialRegistry, getPlatform } from "../registry.js";

import {
  createInstagramDriver,
  createRedditDriver,
  createThreadsDriver,
  createTiktokDriver,
  redditApiPostVideo,
  instagramBrowserPostVideo,
} from "./index.js";

import type { MediaRef, Platform, SocialAccountRef } from "../types.js";

const video: MediaRef = { kind: "video", path: "/tmp/reel.mp4" };

function ref(platform: Platform, id: string): SocialAccountRef {
  return { accountId: asSocialAccountId(id), platform, handle: `@${id}` };
}

describe("social drivers (mock)", () => {
  it("4 драйвера реализуют SocialPlatform и публикуют видео", async () => {
    const drivers = [
      createInstagramDriver(),
      createTiktokDriver(),
      createRedditDriver(),
      createThreadsDriver(),
    ];
    for (const driver of drivers) {
      const session = await driver.login(ref(driver.platform, "acc"));
      const res = await driver.postVideo(session, video);
      expect(res.ok).toBe(true);
      expect(res.platform).toBe(driver.platform);
      expect(res.externalPostId).toBeTruthy();
    }
  });

  it("IG/TikTok — основной механизм phone, поддержка browser", () => {
    for (const driver of [createInstagramDriver(), createTiktokDriver()]) {
      expect(driver.capabilities.mechanisms[0]).toBe("phone");
      expect(driver.capabilities.mechanisms).toContain("browser");
    }
  });

  it("Reddit/Threads — механизм api", () => {
    expect(createRedditDriver().capabilities.mechanisms).toEqual(["api"]);
    expect(createThreadsDriver().capabilities.mechanisms).toEqual(["api"]);
  });

  it("выбор browser-механизма через preferMechanism", async () => {
    const ig = createInstagramDriver();
    const session = await ig.login(ref("instagram", "acc"));
    const res = await ig.postVideo(session, video, { preferMechanism: "browser" });
    expect(res.mechanism).toBe("browser");
  });

  it("неподдерживаемый механизм отклоняется", async () => {
    const reddit = createRedditDriver();
    const session = await reddit.login(ref("reddit", "acc"));
    await expect(reddit.postVideo(session, video, { preferMechanism: "phone" })).rejects.toThrow(
      /не поддерживается/,
    );
  });

  it("phone-драйвер арендует устройство из PhonePool и назначает sticky-прокси", async () => {
    const pool = new PhonePool([createDuoPlusMock()]);
    const proxyMgr = new ProxyManager(
      [createMockProxyProvider({ name: "brightdata" })],
      new InMemoryProxyRepository(),
    );
    const ig = createInstagramDriver({
      phonePool: pool,
      proxyManager: proxyMgr,
      orgId: asOrgId("org-1"),
      dek: generateDataKey(),
    });
    const session = await ig.login(ref("instagram", "acc-phone"));
    expect(session.mechanism).toBe("phone");
    expect(session.sessionRef).toContain("device:");
    expect(session.sessionRef).toContain("proxy:");
    expect(pool.activeCount).toBe(1);
  });

  it("реестр собирается из 4 драйверов", () => {
    const registry = createSocialRegistry([
      createInstagramDriver(),
      createTiktokDriver(),
      createRedditDriver(),
      createThreadsDriver(),
    ]);
    expect(getPlatform(registry, "tiktok").platform).toBe("tiktok");
  });

  it("каркасы реальных драйверов бросают (Фаза 2)", async () => {
    await expect(
      instagramBrowserPostVideo({} as never, video, undefined, {}),
    ).rejects.toThrow(/Фаз[ае] 2/);
    await expect(redditApiPostVideo({} as never, video, undefined, {})).rejects.toThrow(/token/);
  });
});
