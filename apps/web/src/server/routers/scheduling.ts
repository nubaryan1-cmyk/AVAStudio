import { z } from "zod";

import {
  conflictsFor,
  listPosts,
  listSchedulableAccounts,
  removePost,
  reschedule,
  schedulePost,
} from "../data/scheduling.js";
import { publicProcedure, router } from "../trpc.js";

const isoString = z.string().datetime({ offset: true }).or(z.string().min(10));

export const schedulingRouter = router({
  accounts: publicProcedure.query(() => listSchedulableAccounts()),
  posts: publicProcedure.query(() => listPosts()),

  conflicts: publicProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        scheduledAt: isoString,
        excludeId: z.string().optional(),
      }),
    )
    .query(({ input }) => conflictsFor(input)),

  schedule: publicProcedure
    .input(
      z.object({
        accountId: z.string().min(1),
        assetId: z.string().min(1),
        scheduledAt: isoString,
        caption: z.string().max(280).optional(),
      }),
    )
    .mutation(({ input }) => schedulePost(input)),

  reschedule: publicProcedure
    .input(z.object({ id: z.string().min(1), scheduledAt: isoString }))
    .mutation(({ input }) => reschedule(input.id, input.scheduledAt)),

  remove: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) => removePost(input.id)),
});
