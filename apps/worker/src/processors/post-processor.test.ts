import { createLogger } from "@avastudio/shared";
import { createInstagramDriver, createSocialRegistry } from "@avastudio/shared/social";
import { describe, expect, it } from "vitest";

import { InMemoryPostedJobRepository, createPostProcessor } from "./post-platform.js";

import type { Job } from "bullmq";

const ORG = "11111111-1111-4111-8111-111111111111";
const ACC = "22222222-2222-4222-8222-222222222222";
const JOB = "33333333-3333-4333-8333-333333333333";
const ASSET = "44444444-4444-4444-8444-444444444444";
const silent = createLogger({ destination: { write: () => undefined } });

function fakeJob(data: unknown): Job {
  return { id: "j", data } as unknown as Job;
}

function ctx() {
  const registry = createSocialRegistry([createInstagramDriver()]);
  return { registry, postedRepo: new InMemoryPostedJobRepository(), logger: silent };
}

describe("post-platform процессор", () => {
  it("публикует видео через mock-драйвер (phone-механизм)", async () => {
    const c = ctx();
    const out = await createPostProcessor("post-instagram", c)(
      fakeJob({ orgId: ORG, postingJobId: JOB, accountId: ACC, assetId: ASSET, caption: "привет" }),
    );
    expect(out.skipped).toBe(false);
    expect(out.result?.ok).toBe(true);
    expect(out.result?.mechanism).toBe("phone");
    expect(await c.postedRepo.isPosted(JOB)).toBe(true);
  });

  it("идемпотентность: повторный job пропускается", async () => {
    const c = ctx();
    const proc = createPostProcessor("post-instagram", c);
    const data = { orgId: ORG, postingJobId: JOB, accountId: ACC, assetId: ASSET };
    await proc(fakeJob(data));
    const second = await proc(fakeJob(data));
    expect(second.skipped).toBe(true);
  });
});
