import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import ru from "../../messages/ru.json";

/** Рекурсивно собирает все ключи-пути словаря (a.b.c). */
function collectKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    collectKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

describe("i18n message catalogs", () => {
  const ruKeys = new Set(collectKeys(ru));
  const enKeys = new Set(collectKeys(en));

  it("RU и EN имеют идентичные наборы ключей", () => {
    const missingInEn = [...ruKeys].filter((k) => !enKeys.has(k));
    const missingInRu = [...enKeys].filter((k) => !ruKeys.has(k));
    expect(missingInEn, `нет в en.json: ${missingInEn.join(", ")}`).toEqual([]);
    expect(missingInRu, `нет в ru.json: ${missingInRu.join(", ")}`).toEqual([]);
  });

  it("ни одно значение не пустое", () => {
    const empties = collectKeys(ru).filter((path) => {
      const v = path.split(".").reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], ru);
      return typeof v === "string" && v.trim() === "";
    });
    expect(empties).toEqual([]);
  });
});
