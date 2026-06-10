import { describe, expect, it } from "vitest";

import { asPhoneId } from "../../domain/ids.js";

import { createDuoPlusDriver } from "./duoplus.js";

/** DuoPlus отвечает конвертом { code, data, message }. */
function res(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(body) } as unknown as Response;
}

describe("DuoPlus real driver (TASK 22.1)", () => {
  it("throws without api key", async () => {
    const d = createDuoPlusDriver({});
    await expect(d.listDevices()).rejects.toThrow();
  });

  it("rentDevice maps Buy Cloud Phone response", async () => {
    const fetchImpl = (() =>
      Promise.resolve(res({ code: 200, data: { id: "cp_1" }, message: "Success" }))) as unknown as typeof fetch;
    const d = createDuoPlusDriver({ apiKey: "k", fetchImpl });
    const dev = await d.rentDevice({ region: "us" });
    expect(dev.id).toBe("cp_1");
    expect(dev.provider).toBe("duoplus");
    expect(dev.state).toBe("rented");
  });

  it("listDevices maps integer statuses", async () => {
    const fetchImpl = (() =>
      Promise.resolve(
        res({ code: 200, data: { list: [{ id: "a", status: 1 }, { id: "b", status: 2 }] }, message: "Success" }),
      )) as unknown as typeof fetch;
    const d = createDuoPlusDriver({ apiKey: "k", fetchImpl });
    const list = await d.listDevices();
    expect(list).toHaveLength(2);
    expect(list[0]?.state).toBe("rented"); // 1 = powered on
    expect(list[1]?.state).toBe("available"); // 2 = powered off
  });

  it("getStatus reads status from list", async () => {
    const fetchImpl = (() =>
      Promise.resolve(
        res({ code: 200, data: { list: [{ id: "cp_1", status: 1 }] }, message: "Success" }),
      )) as unknown as typeof fetch;
    const d = createDuoPlusDriver({ apiKey: "k", fetchImpl });
    expect(await d.getStatus(asPhoneId("cp_1"))).toBe("rented");
  });

  it("isHealthy false on http error", async () => {
    const fetchImpl = (() => Promise.resolve(res({}, false, 500))) as unknown as typeof fetch;
    const d = createDuoPlusDriver({ apiKey: "k", fetchImpl });
    expect(await d.isHealthy()).toBe(false);
  });

  it("isHealthy false on non-200 code", async () => {
    const fetchImpl = (() =>
      Promise.resolve(res({ code: 160006, message: "path incorrect" }))) as unknown as typeof fetch;
    const d = createDuoPlusDriver({ apiKey: "k", fetchImpl });
    expect(await d.isHealthy()).toBe(false);
  });

  it("executeAction tap returns ok", async () => {
    const fetchImpl = (() =>
      Promise.resolve(res({ code: 200, data: { success: true, content: "" }, message: "" }))) as unknown as typeof fetch;
    const d = createDuoPlusDriver({ apiKey: "k", fetchImpl });
    const r = await d.executeAction(asPhoneId("cp_1"), { kind: "tap", x: 10, y: 20 });
    expect(r.ok).toBe(true);
  });

  it("executeAction screenshot returns base64 content", async () => {
    const fetchImpl = (() =>
      Promise.resolve(
        res({ code: 200, data: { success: true, content: "iVBORw0KGgo=" }, message: "" }),
      )) as unknown as typeof fetch;
    const d = createDuoPlusDriver({ apiKey: "k", fetchImpl });
    const r = await d.executeAction(asPhoneId("cp_1"), { kind: "screenshot" });
    expect(r.ok).toBe(true);
    expect(r.screenshot).toBe("iVBORw0KGgo=");
  });
});
