import { PLATFORMS } from "@avastudio/shared/domain";
import { IMPL_MECHANISMS } from "@avastudio/shared/social";
import { z } from "zod";


import { addAccount, bindPhone, bindProxy, getAccount, listAccounts } from "../data/accounts.js";
import { publicProcedure, router } from "../trpc.js";

const platformEnum = z.enum(PLATFORMS);
const mechanismEnum = z.enum(IMPL_MECHANISMS);

export const accountsRouter = router({
  list: publicProcedure
    .input(z.object({ platform: platformEnum.optional() }).optional())
    .query(({ input }) => listAccounts(input?.platform)),

  byId: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => getAccount(input.id)),

  add: publicProcedure
    .input(
      z.object({
        platform: platformEnum,
        handle: z.string().min(2).max(64),
        mechanism: mechanismEnum,
        secret: z.string().min(1).max(512),
      }),
    )
    .mutation(({ input }) => addAccount(input)),

  bindPhone: publicProcedure
    .input(z.object({ id: z.string().min(1), phoneId: z.string().min(1).nullable() }))
    .mutation(({ input }) => bindPhone(input.id, input.phoneId)),

  bindProxy: publicProcedure
    .input(z.object({ id: z.string().min(1), proxyId: z.string().min(1).nullable() }))
    .mutation(({ input }) => bindProxy(input.id, input.proxyId)),
});
