import { z } from "zod";

import { getStatsOverview } from "../data/stats.js";
import { publicProcedure, router } from "../trpc.js";

export const statsRouter = router({
  overview: publicProcedure
    .input(z.object({ range: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional() }).optional())
    .query(({ input }) => getStatsOverview(input?.range ?? 30)),
});
