import { describe, expect, it } from "vitest";

import {
  estimateGeminiCost,
  GeminiTextProvider,
  generateTextWithFallback,
  type GeminiPort,
  type TextProvider,
} from "./index.js";

const okPort: GeminiPort = { generate: () => Promise.resolve({ text: "hello world" }) };

describe("GeminiTextProvider", () => {
  it("generates text and reports usage", async () => {
    const p = new GeminiTextProvider({ client: okPort });
    const r = await p.generateText({ prompt: "hi" });
    expect(r.text).toBe("hello world");
    expect(r.usage.inputChars).toBe(2);
    expect(r.usage.outputChars).toBe(11);
    expect(r.provider).toBe("gemini");
  });

  it("rejects empty prompt", async () => {
    const p = new GeminiTextProvider({ client: okPort });
    await expect(p.generateText({ prompt: "  " })).rejects.toThrow();
  });

  it("estimates cost from usage", () => {
    expect(estimateGeminiCost({ inputChars: 1000, outputChars: 1000 })).toBe("0.001000");
  });

  it("falls back to next provider on failure", async () => {
    const bad: TextProvider = { name: "bad", generateText: () => Promise.reject(new Error("down")) };
    const good = new GeminiTextProvider({ client: okPort });
    const r = await generateTextWithFallback([bad, good], { prompt: "x" });
    expect(r.text).toBe("hello world");
  });
});
