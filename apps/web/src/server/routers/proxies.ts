import { z } from "zod";

import { assignProxy, listProxyPool, rotateProxy } from "../data/proxies.js";
import { publicProcedure, router } from "../trpc.js";

export const proxiesRouter = router({
  pool: publicProcedure.query(() => listProxyPool()),
  assign: publicProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .mutation(({ input }) => assignProxy(input.accountId)),
  rotate: publicProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .mutation(({ input }) => rotateProxy(input.accountId)),
});
