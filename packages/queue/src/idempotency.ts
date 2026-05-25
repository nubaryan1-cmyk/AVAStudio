import { createHash } from "node:crypto";

import { getRedisConnection } from "./connection.js";

/** Стабильная сериализация (сортировка ключей) — для детерминированного хеша. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/**
 * Детерминированный jobId из имени очереди и данных.
 * Одинаковые данные → одинаковый id → BullMQ дедуплицирует (одна обработка).
 */
export function buildJobId(queue: string, payload: unknown): string {
  const digest = createHash("sha256")
    .update(`${queue}:${stableStringify(payload)}`)
    .digest("hex");
  return `${queue}:${digest.slice(0, 32)}`;
}

/** Минимальный контракт хранилища для idempotency-key (Redis SET ... EX .. NX). */
export interface IdempotencyStore {
  set(key: string, value: string, exToken: "EX", seconds: number, nxToken: "NX"): Promise<unknown>;
}

/**
 * Idempotency-Key для HTTP-API: атомарный SETNX с TTL.
 * Возвращает true — ключ занят впервые (можно обрабатывать),
 * false — дубликат (запрос уже обрабатывался).
 */
export async function claimIdempotencyKey(
  key: string,
  options: { ttlSeconds?: number; store?: IdempotencyStore } = {},
): Promise<boolean> {
  const store = options.store ?? getRedisConnection();
  const ttl = options.ttlSeconds ?? 86_400;
  const result = await store.set(`idem:${key}`, "1", "EX", ttl, "NX");
  return result === "OK";
}
