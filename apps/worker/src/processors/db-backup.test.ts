import { describe, expect, it, vi } from "vitest";

import { backupKey, runDbBackup, type BackupStorage, type DumpRunner } from "./db-backup.js";

const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() } as never;

describe("db-backup", () => {
  it("backupKey is deterministic by date+kind", () => {
    expect(backupKey("daily", new Date("2026-06-02T10:00:00Z"))).toBe("backups/daily/2026-06-02.sql.gz");
    expect(backupKey("weekly", new Date("2026-06-02T23:59:00Z"))).toBe("backups/weekly/2026-06-02.sql.gz");
  });

  it("dumps and uploads", async () => {
    const stored: Record<string, Uint8Array> = {};
    const runner: DumpRunner = { dump: () => Promise.resolve(new Uint8Array([1, 2, 3])) };
    const storage: BackupStorage = {
      put: (k, b) => {
        stored[k] = b;
        return Promise.resolve();
      },
    };
    const res = await runDbBackup(
      { runner, storage, connectionString: "postgres://x", logger, now: () => new Date("2026-06-02T00:00:00Z") },
      "daily",
    );
    expect(res.bytes).toBe(3);
    expect(stored[res.key]).toBeDefined();
  });

  it("throws on empty dump", async () => {
    const runner: DumpRunner = { dump: () => Promise.resolve(new Uint8Array()) };
    const storage: BackupStorage = { put: () => Promise.resolve() };
    await expect(
      runDbBackup({ runner, storage, connectionString: "x", logger }, "daily"),
    ).rejects.toThrow();
  });
});
