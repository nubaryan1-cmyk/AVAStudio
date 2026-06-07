import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

// next-intl middleware тянет ESM-импорт "next/server", который vitest не резолвит
// в этом окружении. Мокаем его passthrough'ом — проверяем только нашу логику auth.
vi.mock("next-intl/middleware", () => ({
  default: () => (): NextResponse => NextResponse.next(),
}));

const { middleware } = await import("./middleware.js");

function req(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(new URL(`https://app.test${path}`), { headers });
}

describe("middleware: i18n + защита роутов (TASK 10.3 / 13.10)", () => {
  it("приватный роут с локалью без сессии → редирект на /<locale>/login", async () => {
    const res = await middleware(req("/ru/dashboard"));
    expect(res.status).toBe(307);
    const loc = res.headers.get("location")!;
    expect(loc).toContain("/ru/login");
    expect(loc).toContain("next=%2Fru%2Fdashboard");
  });

  it("приватный роут без локали без сессии → редирект на дефолтную локаль", async () => {
    const res = await middleware(req("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")!).toContain("/ru/login");
  });

  it("приватный роут с access-cookie → не редиректит на login", async () => {
    const res = await middleware(req("/ru/dashboard", "avs_access=token123"));
    const loc = res.headers.get("location");
    expect(loc === null || !loc.includes("/login")).toBe(true);
  });

  it("публичный роут логина → не редиректит на login", async () => {
    const res = await middleware(req("/ru/login"));
    const loc = res.headers.get("location");
    expect(loc === null || !loc.includes("/login")).toBe(true);
  });
});
