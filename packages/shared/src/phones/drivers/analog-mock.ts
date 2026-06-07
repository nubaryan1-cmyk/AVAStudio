/** Mock-драйвер аналога DuoPlus (GeeLark/MoreLogin) (TASK 12.2). Реальный SDK — Фаза 2. */
import { createMockPhoneProvider, type MockPhoneProviderOptions } from "./mock-base.js";

import type { PhoneProvider } from "../types.js";

/** Аналоговый mock-провайдер (взаимозаменяем с DuoPlus). */
export function createAnalogMock(options: Partial<MockPhoneProviderOptions> = {}): PhoneProvider {
  return createMockPhoneProvider({ name: "geelark", maxDevices: 15, ...options });
}
