/* eslint-disable no-process-env */
import { describe, expect, it } from "vitest";

import { createCaller } from "../routers/_app.js";

import { runLoad } from "./harness.js";
import { userJourney } from "./journey.js";

/**
 * TASK 14.2 — стресс-тест (масштабируемый).
 * В CI прогоняется сокращённый масштаб (детерминированный, быстрый).
 * Полный прогон на 1 000 000 пользователей: `STRESS_USERS=1000000 tsx stress.run.ts`.
 */
const USERS = Number(process.env.STRESS_USERS ?? 20_000);
const CONCURRENCY = Number(process.env.STRESS_CONCURRENCY ?? 1_000);
const WRITE_FRACTION = Number(process.env.STRESS_WRITE_FRACTION ?? 0.02);

describe("стресс: имитация массовой нагрузки по всему функционалу", () => {
  it(
    `держит ${USERS} виртуальных пользователей без ошибок`,
    async () => {
      const caller = createCaller({});
      const result = await runLoad({
        total: USERS,
        concurrency: CONCURRENCY,
        seed: 12345,
        journey: (ctx) => userJourney(caller, ctx, WRITE_FRACTION),
      });

      // Нет ни одной ошибки на всём функциональном пути
      expect(result.errors).toBe(0);
      expect(result.errorRate).toBe(0);
      // Полезная работа выполнена
      expect(result.opsTotal).toBeGreaterThan(USERS);
      expect(result.opsPerSec).toBeGreaterThan(0);
      // Латентность одной операции в разумных пределах (in-process)
      const dash = result.perStep["dashboard.summary"];
      expect(dash).toBeDefined();
      expect(dash!.p99).toBeLessThan(100);
    },
    120_000,
  );
});
