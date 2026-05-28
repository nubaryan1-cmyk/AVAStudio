import { describe, expect, it } from "vitest";

import { createLogger } from "./logger.js";

describe("createLogger", () => {
  it("маскирует чувствительные поля в выводе", () => {
    const lines: string[] = [];
    const logger = createLogger({
      destination: { write: (msg: string) => void lines.push(msg) },
    });
    logger.info({ user: "garnik", password: "p@ss", apiKey: "sk-123" }, "login");
    const out = lines.join("");
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("p@ss");
    expect(out).not.toContain("sk-123");
    expect(out).toContain("garnik");
  });
});
