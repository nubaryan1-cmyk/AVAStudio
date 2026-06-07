/**
 * Cost tracking AI-вызовов (TASK 11.5). Считает estimated_cost по прайс-таблице
 * провайдеров и пишет запись в ai_usage (порт AiUsageRepository — реальная БД в
 * инфраструктуре). Плюс rate-limit per provider поверх resilience-политики (ЭТАП 8),
 * чтобы не превышать квоты. amount денег — десятичная строка (точность), как Money (9.1).
 */
import { money, type Money } from "../payments/types.js";
import { aiPolicy, resilientCall } from "../resilience/index.js";

import type { AiUseCase } from "./types.js";
import type { OrgId } from "../domain/ids.js";

/** Единица тарификации провайдера/модели. */
export const COST_UNITS = ["image", "second", "1k_chars"] as const;
export type CostUnit = (typeof COST_UNITS)[number];

/** Строка прайс-таблицы: цена за единицу в USD (десятичная строка). */
export interface PriceEntry {
  provider: string;
  model: string;
  useCase: AiUseCase;
  unit: CostUnit;
  /** Цена за 1 единицу, USD, десятичная строка. */
  usdPerUnit: string;
}

/**
 * Прайс-таблица (Фаза 1 — ориентировочные значения для unit-экономики; уточняются
 * в Фазе 2 по реальным тарифам). Ключ выбирается по (provider, model).
 */
export const PRICE_TABLE: readonly PriceEntry[] = [
  { provider: "openai-image", model: "gpt-image-1", useCase: "image", unit: "image", usdPerUnit: "0.040" },
  { provider: "replicate-flux", model: "black-forest-labs/flux-schnell", useCase: "image", unit: "image", usdPerUnit: "0.003" },
  { provider: "mock-image", model: "mock-image-v1", useCase: "image", unit: "image", usdPerUnit: "0" },
  { provider: "runway-video", model: "gen3a_turbo", useCase: "video", unit: "second", usdPerUnit: "0.050" },
  { provider: "luma-video", model: "dream-machine", useCase: "video", unit: "second", usdPerUnit: "0.040" },
  { provider: "mock-video", model: "mock-video-v1", useCase: "video", unit: "second", usdPerUnit: "0" },
  { provider: "elevenlabs-tts", model: "eleven_multilingual_v2", useCase: "audio", unit: "1k_chars", usdPerUnit: "0.300" },
  { provider: "cartesia-tts", model: "sonic", useCase: "audio", unit: "1k_chars", usdPerUnit: "0.030" },
  { provider: "mock-tts", model: "mock-tts-v1", useCase: "audio", unit: "1k_chars", usdPerUnit: "0" },
  { provider: "suno-music", model: "chirp-v3", useCase: "music", unit: "second", usdPerUnit: "0.020" },
  { provider: "mock-music", model: "mock-music-v1", useCase: "music", unit: "second", usdPerUnit: "0" },
];

function findPrice(provider: string, model: string): PriceEntry | undefined {
  return PRICE_TABLE.find((p) => p.provider === provider && p.model === model);
}

/** Перемножает десятичную цену на количество единиц, возвращает строку с 6 знаками. */
function multiplyDecimal(usdPerUnit: string, units: number): string {
  const perUnit = Number(usdPerUnit);
  const total = perUnit * units;
  return (Math.round(total * 1e6) / 1e6).toFixed(6);
}

/** Параметры оценки стоимости одного вызова. */
export interface CostInput {
  provider: string;
  model: string;
  /** Кол-во единиц по unit прайса: изображений / секунд / символов. */
  inputSize: number;
  outputSize: number;
}

/**
 * Оценивает стоимость вызова. units берётся из outputSize (что произведено), а для
 * TTS (1k_chars) — из inputSize (символы запроса). Неизвестный provider/model → 0 USD.
 */
export function estimateCost(input: CostInput): Money {
  const entry = findPrice(input.provider, input.model);
  if (entry === undefined) {
    return money("0", "USD", "fiat");
  }
  let units: number;
  if (entry.unit === "1k_chars") {
    units = input.inputSize / 1000;
  } else {
    units = input.outputSize;
  }
  return money(multiplyDecimal(entry.usdPerUnit, units), "USD", "fiat");
}

/** Запись журнала ai_usage. */
export interface AiUsageRecord {
  orgId: OrgId;
  provider: string;
  model: string;
  useCase: AiUseCase;
  inputSize: number;
  outputSize: number;
  estimatedCost: Money;
  latencyMs: number;
  occurredAt: Date;
}

/** Порт хранилища ai_usage (реальная БД — в инфраструктуре). */
export interface AiUsageRepository {
  record(entry: AiUsageRecord): Promise<void>;
  list(orgId: OrgId): Promise<readonly AiUsageRecord[]>;
}

/** In-memory реализация для тестов/локальной разработки. */
export class InMemoryAiUsageRepository implements AiUsageRepository {
  private readonly rows: AiUsageRecord[] = [];

  async record(entry: AiUsageRecord): Promise<void> {
    this.rows.push(entry);
  }

  async list(orgId: OrgId): Promise<readonly AiUsageRecord[]> {
    return this.rows.filter((r) => r.orgId === orgId);
  }

  /** Суммарная оценка стоимости по org (USD, строка). */
  totalUsd(orgId: OrgId): string {
    const total = this.rows
      .filter((r) => r.orgId === orgId)
      .reduce((acc, r) => acc + Number(r.estimatedCost.amount), 0);
    return (Math.round(total * 1e6) / 1e6).toFixed(6);
  }
}

/**
 * Rate-limit per provider: минимальный интервал между вызовами одного провайдера
 * (квоты RPS) + обёртка в aiPolicy (timeout/retry/breaker, ЭТАП 8). Состояние
 * (последнее время вызова) хранится на провайдера.
 */
export class ProviderRateLimiter {
  private readonly minIntervalMs: number;
  private readonly lastCallAt = new Map<string, number>();

  constructor(requestsPerSecond = 2) {
    this.minIntervalMs = requestsPerSecond > 0 ? 1000 / requestsPerSecond : 0;
  }

  /** Гейт по провайдеру → resilientCall(aiPolicy). */
  async run<T>(provider: string, fn: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const last = this.lastCallAt.get(provider) ?? 0;
    const wait = this.minIntervalMs - (now - last);
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.lastCallAt.set(provider, Date.now());
    return resilientCall(fn, aiPolicy);
  }
}
