import { describe, expect, it } from "vitest";

import { createCaller } from "../server/routers/_app.js";

const caller = createCaller({});

/**
 * СУЩ-4: проверка путей ошибок и валидации tRPC-роутеров.
 * Happy-path покрыт в *.test.ts по доменам; здесь — отказы zod и not-found.
 */
describe("accounts router — validation & errors", () => {
  it("byId отклоняет пустой id (zod)", async () => {
    await expect(caller.accounts.byId({ id: "" })).rejects.toThrow();
  });

  it("byId на несуществующий id возвращает null", async () => {
    await expect(caller.accounts.byId({ id: "no-such-account" })).resolves.toBeNull();
  });

  it("add отклоняет слишком короткий handle", async () => {
    await expect(
      caller.accounts.add({ platform: "instagram", handle: "a", mechanism: "api", secret: "x" }),
    ).rejects.toThrow();
  });

  it("add отклоняет неизвестную платформу", async () => {
    await expect(
      // @ts-expect-error намеренно невалидная платформа
      caller.accounts.add({ platform: "myspace", handle: "@ok", mechanism: "api", secret: "x" }),
    ).rejects.toThrow();
  });

  it("add отклоняет пустой secret", async () => {
    await expect(
      caller.accounts.add({ platform: "tiktok", handle: "@ok", mechanism: "api", secret: "" }),
    ).rejects.toThrow();
  });

  it("bindPhone на несуществующий аккаунт бросает not-found", async () => {
    await expect(
      caller.accounts.bindPhone({ id: "no-such-account", phoneId: "phone_demo_1" }),
    ).rejects.toThrow(/не найден/);
  });
});

describe("media router — validation & errors", () => {
  it("byId отклоняет пустой id", async () => {
    await expect(caller.media.byId({ id: "" })).rejects.toThrow();
  });

  it("upload отклоняет неположительный размер", async () => {
    await expect(
      caller.media.upload({
        name: "x.mp4",
        type: "video",
        sizeBytes: 0,
        durationSec: 1,
        width: 10,
        height: 10,
        tags: [],
      }),
    ).rejects.toThrow();
  });

  it("upload отклоняет слишком длинное имя", async () => {
    await expect(
      caller.media.upload({
        name: "n".repeat(129),
        type: "image",
        sizeBytes: 1,
        durationSec: 0,
        width: 1,
        height: 1,
        tags: [],
      }),
    ).rejects.toThrow();
  });
});

describe("scheduling router — validation & errors", () => {
  it("schedule отклоняет пустой accountId", async () => {
    await expect(
      caller.scheduling.schedule({ accountId: "", assetId: "a", scheduledAt: "2030-01-01T10:00:00Z" }),
    ).rejects.toThrow();
  });

  it("remove идемпотентен на несуществующем посте (без исключения)", async () => {
    await expect(caller.scheduling.remove({ id: "no-such-post" })).resolves.toBeDefined();
  });

  it("remove отклоняет пустой id (zod)", async () => {
    await expect(caller.scheduling.remove({ id: "" })).rejects.toThrow();
  });
});
