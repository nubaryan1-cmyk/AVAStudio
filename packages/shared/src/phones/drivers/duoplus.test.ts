import { describe, expect, it } from "vitest";

import { asPhoneId } from "../../domain/ids.js";

import { createDuoPlusDriver } from "./duoplus.js";

function res(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(body) } as unknown as Response;
}

describe("DuoPlus real driver (TASK 22.1)", () => {
  it("throws without api key", async () => {
    const d = createDuoPlusDriver({});
    await expect(d.listDevices()).rejects.toThrow();
  });

  it("rentDevice maps Buy Cloud Phone response", async () => {
    const fetchImpl = (() => Promise.resolve(res({ id: "cp_1", region: "us", androidVersion: "13" }))) as unknown as typeof fetch;
    const d = createDuoPlusDriver({ apiKey: "k", fetchImpl });
    const dev = await d.rentDevice({ region: "us" });
    expect(dev.id).toBe("cp_1");
    expect(dev.provider).toBe("duoplus");
    expect(dev.state).toBe("rented");
  });

  it("listDevices maps statuses", async () => {
    const fetchImpl = (() => Promise.resolve(res({ list: [{ id: "a", status: "running" }, { id: "b", status: "idle" }] }))) as unknown as typeof fetch;
    const d = createDuoPlusDriver({ apiKey: "k", fetchImpl });
    const list = await d.listDevices();
    expect(list).toHaveLength(2);
    expect(list[0]?.state).toBe("rented");
    expect(list[1]?.state).toBe("available");
  });

  it("isHealthy false on error", async () => {
    const fetchImpl = (() => Promise.resolve(res({}, false, 500))) as unknown as typeof fetch;
    const d = createDuoPlusDriver({ apiKey: "k", fetchImpl });
    expect(await d.isHealthy()).toBe(false);
  });

  it("executeAction tap returns ok", async () => {
    const fetchImpl = (() => Promise.resolve(res({ output: "" }))) as unknown as typeof fetch;
    const d = createDuoPlusDriver({ apiKey: "k", fetchImpl });
    const r = await d.executeAction(asPhoneId("cp_1"), { kind: "tap", x: 10, y: 20 });
    expect(r.ok).toBe(true);
  });
});
