/** Mock-драйвер DuoPlus (TASK 12.2). Реальный SDK — Фаза 2 (ЭТАП 22). */
import { createMockPhoneProvider, type MockPhoneProviderOptions } from "./mock-base.js";

import type { PhoneProvider } from "../types.js";

/** DuoPlus mock-провайдер. */
export function createDuoPlusMock(options: Partial<MockPhoneProviderOptions> = {}): PhoneProvider {
  return createMockPhoneProvider({ name: "duoplus", maxDevices: 20, ...options });
}
