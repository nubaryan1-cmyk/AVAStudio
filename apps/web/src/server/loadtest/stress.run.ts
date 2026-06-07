/* eslint-disable no-process-env */
/**
 * CLI-прогон стресс-теста. Имитация N виртуальных пользователей по всему
 * функционалу через in-process tRPC-caller (без внешних подключений).
 *
 *   STRESS_USERS=1000000 STRESS_CONCURRENCY=2000 \
 *     corepack pnpm exec tsx src/server/loadtest/stress.run.ts
 */
import { createCaller } from "../routers/_app.js";

import { runLoad, type LatencyDigest } from "./harness.js";
import { userJourney } from "./journey.js";

const USERS = Number(process.env.STRESS_USERS ?? 1_000_000);
const CONCURRENCY = Number(process.env.STRESS_CONCURRENCY ?? 2_000);
const WRITE_FRACTION = Number(process.env.STRESS_WRITE_FRACTION ?? 0.01);

function fmt(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function row(name: string, d: LatencyDigest): string {
  return (
    `  ${name.padEnd(26)} n=${String(d.count).padStart(9)}  ` +
    `p50=${d.p50.toFixed(3)}ms  p95=${d.p95.toFixed(3)}ms  ` +
    `p99=${d.p99.toFixed(3)}ms  max=${d.max.toFixed(2)}ms`
  );
}

async function main(): Promise<void> {
  const caller = createCaller({});
  process.stdout.write(
    `▶ Стресс: ${fmt(USERS)} пользователей, конкурентность ${fmt(CONCURRENCY)}, ` +
      `доля записи ${(WRITE_FRACTION * 100).toFixed(1)}%\n`,
  );

  const result = await runLoad({
    total: USERS,
    concurrency: CONCURRENCY,
    seed: 12345,
    journey: (ctx) => userJourney(caller, ctx, WRITE_FRACTION),
    onProgress: (done, total) =>
      process.stdout.write(`  … ${fmt(done)}/${fmt(total)}\n`),
  });

  process.stdout.write("\n══════════ РЕЗУЛЬТАТ ══════════\n");
  process.stdout.write(`Пользователей:     ${fmt(result.totalUsers)}\n`);
  process.stdout.write(`Операций всего:    ${fmt(result.opsTotal)}\n`);
  process.stdout.write(`Длительность:      ${fmt(result.durationMs)} ms\n`);
  process.stdout.write(`Throughput:        ${fmt(result.opsPerSec)} ops/sec\n`);
  process.stdout.write(`Ошибок:            ${result.errors} (${(result.errorRate * 100).toFixed(4)}%)\n`);
  process.stdout.write("\nЛатентность по шагам:\n");
  for (const [name, d] of Object.entries(result.perStep)) {
    process.stdout.write(row(name, d) + "\n");
  }

  if (result.errors > 0) {
    process.exitCode = 1;
    process.stderr.write("\n✗ Обнаружены ошибки под нагрузкой\n");
  } else {
    process.stdout.write("\n✓ Ошибок нет — функционал стабилен под нагрузкой\n");
  }
}

void main();
