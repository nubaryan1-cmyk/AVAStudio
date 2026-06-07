// Публичный API пула облачных телефонов (ADR-016, ЭТАП 12). Подпуть @avastudio/shared/phones.
export * from "./types.js";
export * from "./pool.js";
export * from "./drivers/mock-base.js";
export * from "./drivers/duoplus-mock.js";
export * from "./drivers/duoplus.js";
export * from "./drivers/geelark.js";
export * from "./drivers/analog-mock.js";
