import { describe, expect, it } from "vitest";

import { PhonePool } from "../pool.js";

import { createDuoPlusDriver } from "./duoplus.js";
import { createGeeLarkDriver } from "./geelark.js";

function res(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: () => Promise.resolve(body) } as unknown as Response;
}

describe("GeeLark driver + failover (TASK 22.2)", () => {
  it("rents via geelark", async () => {
    const fetchImpl = (() => Promise.resolve(res({ id: "gl_1" }))) as unknown as typeof fetch;
    const d = createGeeLarkDriver({ apiKey: "k", fetchImpl });
    const dev = await d.rentDevice({ region: "eu" });
    expect(dev.provider).toBe("geelark");
    expect(dev.id).toBe("gl_1");
  });

  it("PhonePool fails over DuoPlus → GeeLark without business-code change", async () => {
    // DuoPlus «лежит» (любой запрос падает) → isHealthy=false; GeeLark здоров и выдаёт.
    const duoFetch = (() => Promise.resolve(res({}, false, 503))) as unknown as typeof fetch;
    const geeFetch = ((url: string) =>
      Promise.resolve(res(String(url).includes("/phone/list") ? { items: [] } : { id: "gl_2" }))) as unknown as typeof fetch;
    const pool = new PhonePool([
      createDuoPlusDriver({ apiKey: "k", fetchImpl: duoFetch }),
      createGeeLarkDriver({ apiKey: "k", fetchImpl: geeFetch }),
    ]);
    const lease = await pool.acquire({ region: "us" });
    expect(lease.provider).toBe("geelark");
    expect(lease.device.id).toBe("gl_2");
  });
});
