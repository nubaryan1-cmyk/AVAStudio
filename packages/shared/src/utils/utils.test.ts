import { describe, expect, it } from "vitest";

import { getHourInTz, isPrimeTime } from "./datetime.js";
import { formatDuration, formatFileSize, formatNumber, usagePercent } from "./format.js";
import { newId } from "./id.js";
import { jitter, randomChoice, randomInt, shuffle } from "./random.js";
import { err, isErr, isOk, mapResult, ok, unwrap, unwrapOr } from "./result.js";

describe("Result", () => {
  it("ok/err и предикаты", () => {
    expect(isOk(ok(1))).toBe(true);
    expect(isErr(err("e"))).toBe(true);
  });
  it("mapResult применяет только к ok", () => {
    expect(unwrap(mapResult(ok(2), (x) => x * 3))).toBe(6);
    expect(isErr(mapResult(err("e"), (x: number) => x))).toBe(true);
  });
  it("unwrap бросает на err, unwrapOr возвращает запасное", () => {
    expect(() => unwrap(err(new Error("boom")))).toThrow("boom");
    expect(unwrapOr(err("e"), 42)).toBe(42);
  });
});

describe("id", () => {
  it("newId уникален и в формате uuid", () => {
    const a = newId();
    const b = newId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
  });
  it("uuid v7 сортируется по времени", () => {
    const first = newId();
    const second = newId();
    expect([first, second].sort()[0]).toBe(first);
  });
});

describe("datetime", () => {
  it("getHourInTz учитывает таймзону", () => {
    const d = new Date("2026-06-01T12:00:00Z"); // 12:00 UTC
    expect(getHourInTz(d, "UTC")).toBe(12);
    expect(getHourInTz(d, "Europe/Moscow")).toBe(15); // +3
  });
  it("isPrimeTime по локальному окну", () => {
    const evening = new Date("2026-06-01T19:00:00Z");
    expect(isPrimeTime(evening, "UTC")).toBe(true);
    expect(isPrimeTime(evening, "UTC", { startHour: 6, endHour: 10 })).toBe(false);
  });
});

describe("format", () => {
  it("formatFileSize", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
  it("formatDuration", () => {
    expect(formatDuration(83)).toBe("1:23");
    expect(formatDuration(5)).toBe("0:05");
  });
  it("formatNumber группирует", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
  it("usagePercent с защитой от total<=0", () => {
    expect(usagePercent(73, 100)).toBe(73);
    expect(usagePercent(5, 0)).toBe(0);
    expect(usagePercent(200, 100)).toBe(100);
  });
});

describe("random (anti-ban)", () => {
  it("randomInt в диапазоне", () => {
    for (let i = 0; i < 200; i += 1) {
      const v = randomInt(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(10);
    }
  });
  it("jitter в пределах base±factor", () => {
    for (let i = 0; i < 200; i += 1) {
      const v = jitter(1000, 0.2);
      expect(v).toBeGreaterThanOrEqual(800);
      expect(v).toBeLessThanOrEqual(1200);
    }
  });
  it("randomChoice возвращает элемент, бросает на пустом", () => {
    expect([1, 2, 3]).toContain(randomChoice([1, 2, 3]));
    expect(() => randomChoice([])).toThrow();
  });
  it("shuffle сохраняет состав и длину", () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input);
    expect(out).toHaveLength(5);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5]); // не мутирует
  });
});
