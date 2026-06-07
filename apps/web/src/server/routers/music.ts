import { z } from "zod";

import { createMix, importTrend, listTrends } from "../data/music.js";
import { publicProcedure, router } from "../trpc.js";

const platformEnum = z.enum(["tiktok", "instagram", "youtube"]);

export const musicRouter = router({
  trends: publicProcedure
    .input(
      z
        .object({
          platform: platformEnum.optional(),
          limit: z.number().int().min(1).max(50).optional(),
        })
        .optional(),
    )
    .query(({ input }) => listTrends(input ?? undefined)),

  importTrend: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ input }) => importTrend(input.id)),

  createMix: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128),
        trackIds: z.array(z.string().min(1)).min(2).max(16),
      }),
    )
    .mutation(({ input }) => createMix(input)),
});
