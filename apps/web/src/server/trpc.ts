import { initTRPC } from "@trpc/server";
import superjson from "superjson";

/** Базовая инициализация tRPC (Фаза 1: без контекста авторизации — локально). */
const t = initTRPC.create({ transformer: superjson });

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;
