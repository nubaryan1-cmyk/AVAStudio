import { describe, expect, it } from "vitest";

import { createAnalogMock } from "./drivers/analog-mock.js";
import { createDuoPlusMock } from "./drivers/duoplus-mock.js";
import { createMockPhoneProvider } from "./drivers/mock-base.js";
import { PhonePool } from "./pool.js";

describe("PhonePool", () => {
  it("выдаёт устройство через первого провайдера", async () => {
    const pool = new PhonePool([createDuoPlusMock(), createAnalogMock()]);
    const lease = await pool.acquire({ region: "us" });
    expect(lease.provider).toBe("duoplus");
    expect(lease.device.state).toBe("rented");
    expect(lease.device.region).toBe("us");
    expect(pool.activeCount).toBe(1);
  });

  it("failover A→B когда провайдер A недоступен", async () => {
    const down = createDuoPlusMock({ down: true });
    const up = createAnalogMock();
    const pool = new PhonePool([down, up]);
    const lease = await pool.acquire();
    expect(lease.provider).toBe("geelark");
    expect(pool.activeCount).toBe(1);
  });

  it("бросает, когда все провайдеры недоступны", async () => {
    const pool = new PhonePool([
      createDuoPlusMock({ down: true }),
      createAnalogMock({ down: true }),
    ]);
    await expect(pool.acquire()).rejects.toThrow(/нет доступных провайдеров/);
  });

  it("release возвращает устройство в idle и re-use работает по label", async () => {
    const pool = new PhonePool([createDuoPlusMock()], { reuse: true });
    const first = await pool.acquire({ label: "acc-1" });
    expect(pool.activeCount).toBe(1);
    await pool.release(first.device.id);
    expect(pool.activeCount).toBe(0);
    expect(pool.idleCount).toBe(1);
    const second = await pool.acquire({ label: "acc-1" });
    expect(second.device.id).toBe(first.device.id);
    expect(pool.idleCount).toBe(0);
    expect(pool.activeCount).toBe(1);
  });

  it("без reuse release реально освобождает устройство у провайдера", async () => {
    const pool = new PhonePool([createDuoPlusMock()], { reuse: false });
    const lease = await pool.acquire({ label: "acc-1" });
    await pool.release(lease.device.id);
    expect(pool.idleCount).toBe(0);
    expect(pool.activeCount).toBe(0);
  });

  it("два mock-провайдера взаимозаменяемы (один интерфейс)", async () => {
    const a = createMockPhoneProvider({ name: "prov-a", maxDevices: 1 });
    const b = createMockPhoneProvider({ name: "prov-b", maxDevices: 1 });
    const pool = new PhonePool([a, b]);
    const first = await pool.acquire();
    expect(first.provider).toBe("prov-a");
    // prov-a исчерпан (maxDevices=1) → failover на prov-b
    const second = await pool.acquire();
    expect(second.provider).toBe("prov-b");
  });

  it("executeAction screenshot возвращает данные", async () => {
    const prov = createDuoPlusMock();
    const dev = await prov.rentDevice({});
    const res = await prov.executeAction(dev.id, { kind: "screenshot" });
    expect(res.ok).toBe(true);
    expect(res.screenshot).toContain("base64");
  });
});
