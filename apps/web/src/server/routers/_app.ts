import { createCallerFactory, router } from "../trpc.js";

import { accountsRouter } from "./accounts.js";
import { auditRouter } from "./audit.js";
import { autopilotRouter } from "./autopilot.js";
import { billingRouter } from "./billing.js";
import { dashboardRouter } from "./dashboard.js";
import { editorRouter } from "./editor.js";
import { generationRouter } from "./generation.js";
import { mediaRouter } from "./media.js";
import { musicRouter } from "./music.js";
import { personasRouter } from "./personas.js";
import { proxiesRouter } from "./proxies.js";
import { schedulingRouter } from "./scheduling.js";
import { settingsRouter } from "./settings.js";
import { statsRouter } from "./stats.js";

export const appRouter = router({
  dashboard: dashboardRouter,
  accounts: accountsRouter,
  audit: auditRouter,
  autopilot: autopilotRouter,
  media: mediaRouter,
  editor: editorRouter,
  generation: generationRouter,
  music: musicRouter,
  personas: personasRouter,
  proxies: proxiesRouter,
  scheduling: schedulingRouter,
  settings: settingsRouter,
  stats: statsRouter,
  billing: billingRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
