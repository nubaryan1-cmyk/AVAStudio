import { describe, expect, it } from "vitest";

import { createMockImageProvider, createOpenAIImageProvider, createReplicateImageProvider } from "./index.js";

describe("mock image driver", () => {
  it("генерирует n изображений нужного размера", async () => {
    const provider = createMockImageProvider();
    const res = await provider.generateImage({ prompt: "cat", size: "512x768", n: 3 });
    expect(res.images).toHaveLength(3);
    expect(res.images[0]?.width).toBe(512);
    expect(res.images[0]?.height).toBe(768);
    expect(res.meta.useCase).toBe("image");
  });

  it("первый ассет — встроенный плейсхолдер (data URI)", async () => {
    const res = await createMockImageProvider().generateImage({ prompt: "x" });
    expect(res.images[0]?.url.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("fail:true бросает (для проверки fallback)", async () => {
    await expect(createMockImageProvider({ fail: true }).generateImage({ prompt: "x" })).rejects.toThrow();
  });
});

describe("каркасы реальных драйверов (Фаза 2)", () => {
  it("openai без ключа неактивен", async () => {
    await expect(createOpenAIImageProvider().generateImage({ prompt: "x" })).rejects.toThrow(/ключ/);
  });
  it("replicate без токена неактивен", async () => {
    await expect(createReplicateImageProvider().generateImage({ prompt: "x" })).rejects.toThrow(/токен/);
  });
});
