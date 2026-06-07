/**
 * Реестр драйверов соцплатформ (TASK 12.1). Маппинг platform → SocialPlatform.
 * Регистрируются mock-драйверы (Фаза 1) или реальные (Фаза 2) без изменения
 * вызывающего кода (scheduler/постинг).
 */
import type { SocialPlatform } from "./types.js";
import type { Platform } from "../domain/enums.js";

export type SocialRegistry = ReadonlyMap<Platform, SocialPlatform>;

/** Собирает реестр из списка драйверов (ключ = driver.platform). */
export function createSocialRegistry(drivers: readonly SocialPlatform[]): SocialRegistry {
  const map = new Map<Platform, SocialPlatform>();
  for (const driver of drivers) {
    map.set(driver.platform, driver);
  }
  return map;
}

/** Достаёт драйвер платформы или бросает, если не зарегистрирован. */
export function getPlatform(registry: SocialRegistry, platform: Platform): SocialPlatform {
  const driver = registry.get(platform);
  if (driver === undefined) {
    throw new Error(`SocialPlatform не зарегистрирован: ${platform}`);
  }
  return driver;
}
