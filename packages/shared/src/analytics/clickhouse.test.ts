import { describe, expect, it } from "vitest";

import { ClickHouseBatchLoader, type ClickHouseClient } from "./clickhouse.js";

describe("clickhouse batch loader (25.4)", () => {
  it("flushes when batch full, not before", async () => {
    const inserts: Array<{ table: string; rows: number }> = [];
    const client: ClickHouseClient = { insert: (t, r) => { inserts.push({ table: t, rows: r.length }); return Promise.resolve(); } };
    const loader = new ClickHouseBatchLoader({ client, batchSize: 2 });
    await loader.add("usage_events", { a: 1 });
    expect(inserts).toHaveLength(0);
    expect(loader.pending("usage_events")).toBe(1);
    await loader.add("usage_events", { a: 2 });
    expect(inserts).toEqual([{ table: "usage_events", rows: 2 }]);
  });
  it("manual flush sends remainder", async () => {
    const inserts: number[] = [];
    const client: ClickHouseClient = { insert: (_t, r) => { inserts.push(r.length); return Promise.resolve(); } };
    const loader = new ClickHouseBatchLoader({ client, batchSize: 100 });
    await loader.add("ai_usage", { cost: 1 });
    await loader.flush();
    expect(inserts).toEqual([1]);
  });
});
