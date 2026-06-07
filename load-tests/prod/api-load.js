// k6 нагрузочный тест prod/staging (TASK 26.2). Цель ~1k RPS на API без падений.
// Запуск: k6 run -e BASE_URL=https://app.avastudio.com load-tests/prod/api-load.js
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://app.avastudio.com";

export const options = {
  scenarios: {
    // Разогрев → плато ~1k RPS → спад.
    ramping: {
      executor: "ramping-arrival-rate",
      startRate: 50,
      timeUnit: "1s",
      preAllocatedVUs: 200,
      maxVUs: 2000,
      stages: [
        { target: 200, duration: "1m" },
        { target: 1000, duration: "3m" },
        { target: 1000, duration: "5m" },
        { target: 0, duration: "1m" },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"], // <1% ошибок
    http_req_duration: ["p(95)<500", "p(99)<1000"], // p95<500ms, p99<1s
  },
};

const ENDPOINTS = ["/api/health", "/", "/ru/pricing", "/api/trpc/dashboard.summary"];

export default function () {
  const path = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
  const res = http.get(`${BASE_URL}${path}`);
  check(res, { "status is 2xx/3xx": (r) => r.status >= 200 && r.status < 400 });
  sleep(0.1);
}
