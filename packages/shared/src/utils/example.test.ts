import { describe, expect, it } from "vitest";

import { add } from "./example.js";

describe("add", () => {
  it("складывает два числа", () => {
    expect(add(2, 3)).toBe(5);
  });

  it("работает с отрицательными", () => {
    expect(add(-2, 5)).toBe(3);
  });
});

describe("MSW", () => {
  it("перехватывает HTTP-запрос и возвращает мок", async () => {
    const res = await fetch("https://api.example.com/ping");
    const data = (await res.json()) as { ok: boolean };
    expect(data.ok).toBe(true);
  });
});
