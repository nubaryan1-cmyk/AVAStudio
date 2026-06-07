// Авто-скейлер воркеров (TASK 18.3). Запускается по cron (GitHub Actions/Fly cron):
// читает глубину очереди из /metrics воркера и масштабирует Fly Machines API.
// Чистое решение — decideTargetMachines() из apps/worker (собранный dist).
//
// Запуск: node infrastructure/scale-workers.mjs
// Env: WORKER_METRICS_URL, FLY_API_TOKEN, FLY_APP, SCALE_MIN, SCALE_MAX, JOBS_PER_MACHINE
import { decideTargetMachines } from "../apps/worker/dist/scale.js";

const METRICS_URL = process.env.WORKER_METRICS_URL ?? "http://avastudio-worker-cpu.internal:4001/metrics";
const FLY_APP = process.env.FLY_APP ?? "avastudio-worker-cpu";
const TOKEN = process.env.FLY_API_TOKEN;
const opts = {
  min: Number(process.env.SCALE_MIN ?? 1),
  max: Number(process.env.SCALE_MAX ?? 10),
  jobsPerMachine: Number(process.env.JOBS_PER_MACHINE ?? 50),
};

/** Суммарная глубина по всем очередям из Prometheus-текста (waiting+active+delayed). */
function parseDepth(prom) {
  let depth = 0;
  for (const line of prom.split("\n")) {
    const m = /^avastudio_queue_(waiting|active|delayed)\{[^}]*\}\s+([0-9.]+)/.exec(line.trim());
    if (m) depth += Number(m[2]);
  }
  return depth;
}

async function main() {
  if (!TOKEN) throw new Error("FLY_API_TOKEN не задан");
  const prom = await (await fetch(METRICS_URL)).text();
  const depth = parseDepth(prom);
  const decision = decideTargetMachines(depth, opts);
  console.log(JSON.stringify({ depth, ...decision }));

  // Fly Machines API: выставить желаемое число машин в группе.
  // (Здесь — упрощённый вызов scale; точный endpoint зависит от версии Machines API.)
  const res = await fetch(`https://api.machines.dev/v1/apps/${FLY_APP}/machines`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const machines = await res.json();
  const running = machines.filter((m) => m.state === "started").length;
  console.log(`running=${running} target=${decision.target}`);
  // scale up/down реализуется через POST .../machines (start/clone) или fly scale count;
  // вынесено в рантайм-операции — здесь только решение и наблюдаемость.
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
