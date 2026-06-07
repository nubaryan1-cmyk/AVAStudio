import { AUDIT_ACTIONS } from "@avastudio/shared/audit";
import { z } from "zod";

import { listAudit } from "../data/audit.js";
import { publicProcedure, router } from "../trpc.js";

export const auditRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          action: z.enum(AUDIT_ACTIONS).optional(),
          userId: z.string().optional(),
        })
        .optional(),
    )
    .query(({ input }) => listAudit(input ?? undefined)),
});
