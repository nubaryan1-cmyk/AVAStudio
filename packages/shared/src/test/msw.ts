import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

/** Базовые MSW-обработчики для тестов (пример мокинга HTTP). */
export const handlers = [
  http.get("https://api.example.com/ping", () => HttpResponse.json({ ok: true })),
];

export const server = setupServer(...handlers);
