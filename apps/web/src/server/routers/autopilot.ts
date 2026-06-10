import { z } from "zod";

import { runAutopilot } from "../data/autopilot.js";
import { ensureAccountsReady } from "../data/accounts.js";
import { listSchedulableAccounts } from "../data/scheduling.js";
import { publicProcedure, router } from "../trpc.js";

export const autopilotRouter = router({
  accounts: publicProcedure.query(async () => {
    await ensureAccountsReady();
    return listSchedulableAccounts();
  }),

  run: publicProcedure
    .input(
      z.object({
        assetId: z.string().min(1),
        accountIds: z.array(z.string().min(1)).min(1).max(50),
        postsPerAccount: z.number().int().min(1).max(14),
        caption: z.string().max(280).optional(),
      }),
    )
    .mutation(({ input }) => runAutopilot(input)),
});
