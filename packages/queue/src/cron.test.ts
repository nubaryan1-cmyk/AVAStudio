import { describe, expect, it } from "vitest";

import { CRON_SCHEDULES, MAINTENANCE_QUEUE } from "./cron.js";

const FIVE_FIELD_CRON = /^\S+\s+\S+\s+\S+\s+\S+\s+\S+$/;

describe("cron-расписания", () => {
  it("определены 3 расписания с ожидаемыми id", () => {
    expect(CRON_SCHEDULES).toHaveLength(3);
    expect(CRON_SCHEDULES.map((s) => s.id)).toEqual([
      "cleanup-expired-sessions",
      "aggregate-usage",
      "db-backup-local",
    ]);
  });

  it("каждый pattern — валидный 5-польный cron", () => {
    for (const s of CRON_SCHEDULES) {
      expect(s.pattern).toMatch(FIVE_FIELD_CRON);
    }
  });

  it("очистка сессий — каждые 6 часов", () => {
    expect(CRON_SCHEDULES.find((s) => s.id === "cleanup-expired-sessions")?.pattern).toBe(
      "0 */6 * * *",
    );
  });

  it("очередь обслуживания названа maintenance", () => {
    expect(MAINTENANCE_QUEUE).toBe("maintenance");
  });
});
