import { createLogger } from "@avastudio/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startHealthServer, type HealthServer } from "./health.js";

const silent = createLogger({ destination: { write: () => undefined } });

describe("health endpoints (Hono)", () => {
  let server: HealthServer;
  let base: string;
  beforeAll(async () => {
    server = await startHealthServer({
      port: 0,
      redis: { ping: () => Promise.resolve("PONG") },
      logger: silent,
    });
    base = `http://127.0.0.1:${server.port}`;
  });
  afterAll(async () => {
    await server.close();
  });

  it("/health → 200 при живом Redis", async () => {
    const r = await fetch(`${base}/health`);
    expect(r.status).toBe(200);
    const j = (await r.json()) as { status: string };
    expect(j.status).toBe("ok");
  });

  it("/metrics → 200 (заглушка)", async () => {
    const r = await fetch(`${base}/metrics`);
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("placeholder");
  });
});

describe("/health 503 при недоступном Redis", () => {
  let server: HealthServer;
  beforeAll(async () => {
    server = await startHealthServer({
      port: 0,
      redis: { ping: () => Promise.reject(new Error("connection refused")) },
      logger: silent,
    });
  });
  afterAll(async () => {
    await server.close();
  });
  it("возвращает 503 down", async () => {
    const r = await fetch(`http://127.0.0.1:${server.port}/health`);
    expect(r.status).toBe(503);
    const j = (await r.json()) as { status: string };
    expect(j.status).toBe("down");
  });
});
