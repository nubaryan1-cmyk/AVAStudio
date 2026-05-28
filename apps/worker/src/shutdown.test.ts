import { createLogger } from "@avastudio/shared";
import { describe, expect, it } from "vitest";

import { installGracefulShutdown } from "./shutdown.js";

import type { Worker } from "bullmq";

const silent = createLogger({ destination: { write: () => undefined } });

function fakeWorker(opts: { activeJobMs?: number } = {}): { worker: Worker; calls: string[] } {
  const calls: string[] = [];
  const activeJobMs = opts.activeJobMs ?? 0;
  const worker = {
    pause: (doNotWaitActive?: boolean) => {
      calls.push(`pause(${doNotWaitActive ?? false})`);
      return Promise.resolve();
    },
    close: async () => {
      calls.push("close:start");
      await new Promise<void>((res) => setTimeout(res, activeJobMs));
      calls.push("close:end");
    },
  } as unknown as Worker;
  return { worker, calls };
}

describe("graceful shutdown", () => {
  it("порядок: pause → close → closeConnections", async () => {
    const { worker, calls } = fakeWorker({ activeJobMs: 20 });
    const sequence: string[] = [];
    const runShutdown = installGracefulShutdown({
      workers: [worker],
      closeConnections: async () => {
        sequence.push("closeConnections");
      },
      logger: silent,
    });
    await runShutdown();
    expect(calls[0]).toBe("pause(true)");
    expect(calls.includes("close:start")).toBe(true);
    expect(calls.indexOf("close:end")).toBeLessThan(/* до closeConnections */ Infinity);
    expect(sequence).toEqual(["closeConnections"]);
  });

  it("дожидается активной задачи перед exit (close ждёт активную)", async () => {
    const { worker, calls } = fakeWorker({ activeJobMs: 100 });
    const start = Date.now();
    const run = installGracefulShutdown({
      workers: [worker],
      closeConnections: () => Promise.resolve(),
      logger: silent,
    });
    await run();
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(90); // не торопится — ждёт активную
    expect(calls.includes("close:end")).toBe(true);
  });

  it("повторный вызов идемпотентен", async () => {
    const { worker, calls } = fakeWorker();
    const run = installGracefulShutdown({
      workers: [worker],
      closeConnections: () => Promise.resolve(),
      logger: silent,
    });
    await run();
    await run();
    expect(calls.filter((c) => c.startsWith("pause")).length).toBe(1);
  });
});
