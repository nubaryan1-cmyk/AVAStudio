// Публичный API телеметрии (OpenTelemetry). ВНИМАНИЕ: только для серверных
// процессов (worker/web server) — содержит Node-only инструментирование,
// поэтому НЕ ре-экспортируется из корневого index.ts (чтобы не утянуть в браузер).
export * from "./sdk.js";
export * from "./context.js";
