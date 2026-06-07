import { describe, expect, it, vi } from "vitest";

import { createSendEmailProcessor, type EmailSender } from "./send-email.js";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() } as never;

function job(data: unknown) {
  return { data } as never;
}

describe("send-email processor", () => {
  it("renders and sends known template", async () => {
    const sent: unknown[] = [];
    const sender: EmailSender = { send: (i) => { sent.push(i); return Promise.resolve(); } };
    const proc = createSendEmailProcessor({ sender, from: "no-reply@avastudio.com", logger });
    const res = await proc(job({ to: "a@b.co", template: "payment_succeeded", data: { amount: "19.99", currency: "USD" } }));
    expect(res.template).toBe("payment_succeeded");
    expect(sent).toHaveLength(1);
  });

  it("throws on unknown template", async () => {
    const sender: EmailSender = { send: () => Promise.resolve() };
    const proc = createSendEmailProcessor({ sender, from: "x@y.z", logger });
    await expect(proc(job({ to: "a@b.co", template: "nope" }))).rejects.toThrow();
  });
});
