import { describe, expect, it } from "vitest";

import { R2StorageAdapter, type S3BucketPort } from "./r2-adapter.js";

function fakeBucket(): S3BucketPort & { store: Map<string, Uint8Array> } {
  const store = new Map<string, Uint8Array>();
  return {
    store,
    put: (i) => { store.set(i.key, i.body); return Promise.resolve(); },
    get: (k) => Promise.resolve(store.get(k) ?? null),
    delete: (k) => { store.delete(k); return Promise.resolve(); },
  };
}

describe("R2StorageAdapter (TASK 25.1)", () => {
  it("put returns r2 storagePath, get round-trips", async () => {
    const bucket = fakeBucket();
    const a = new R2StorageAdapter({ bucket, bucketName: "media" });
    const path = await a.put("org1/asset1.mp4", new Uint8Array([1, 2, 3]));
    expect(path).toBe("r2://media/org1/asset1.mp4");
    const got = await a.get(path);
    expect(got).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("publicUrl builds CDN url", () => {
    const a = new R2StorageAdapter({ bucket: fakeBucket(), bucketName: "media", cdnBaseUrl: "https://cdn.avastudio.com/" });
    expect(a.publicUrl("r2://media/x/y.png")).toBe("https://cdn.avastudio.com/x/y.png");
  });

  it("remove deletes", async () => {
    const bucket = fakeBucket();
    const a = new R2StorageAdapter({ bucket, bucketName: "media" });
    const p = await a.put("k.bin", new Uint8Array([9]));
    await a.remove(p);
    expect(await a.get(p)).toBeNull();
  });
});
