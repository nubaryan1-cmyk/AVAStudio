import type { Logger } from "@avastudio/shared";
import type { Worker } from "bullmq";

export interface ShutdownDeps {
  workers: Worker[];
  healthServer?: { close: () => Promise<void> };
  closeConnections: () => Promise<void>;
  logger: Logger;
  /** Максимум ожидания текущих job'ов (по умолчанию 30с). */
  timeoutMs?: number;
}

/**
 * Регистрирует graceful shutdown по SIGTERM/SIGINT:
 *   1) pause(true) — перестать брать новые задачи,
 *   2) close() — дождаться текущих (с таймаутом),
 *   3) закрыть health-сервер,
 *   4) закрыть соединения (Redis/DB),
 *   5) exit 0.
 * Возвращает функцию `runShutdown` (для тестов).
 */
export function installGracefulShutdown(deps: ShutdownDeps): () => Promise<void> {
  let shuttingDown = false;
  const runShutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    deps.logger.info("graceful shutdown: начат");
    try {
      // 1. Прекратить приём новых задач
      await Promise.all(deps.workers.map((w) => w.pause(true).catch(() => undefined)));
      // 2. Закрытие воркеров с таймаутом — дожидаемся текущих
      const closingAll = Promise.all(deps.workers.map((w) => w.close()));
      const limit = new Promise<void>((res) => setTimeout(res, deps.timeoutMs ?? 30_000));
      await Promise.race([closingAll, limit]);
      // 3. Health-сервер
      if (deps.healthServer) await deps.healthServer.close();
      // 4. Соединения
      await deps.closeConnections();
      deps.logger.info("graceful shutdown: завершён");
    } catch (error) {
      deps.logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        "ошибка во время shutdown",
      );
    }
  };

  const handler = (): void => {
    void runShutdown().then(() => process.exit(0));
  };
  process.on("SIGTERM", handler);
  process.on("SIGINT", handler);
  return runShutdown;
}
