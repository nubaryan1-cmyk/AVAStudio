import { PLAN_IDS } from "@avastudio/shared/billing";
import { z } from "zod";

import {
  applyPromo,
  createUpgradeCheckout,
  diagnoseAccount,
  getBillingState,
} from "../data/billing.js";
import { publicProcedure, router } from "../trpc.js";

const planEnum = z.enum(PLAN_IDS);
const methodEnum = z.enum(["card", "crypto"] as const);

export const billingRouter = router({
  state: publicProcedure.query(() => getBillingState()),

  applyPromo: publicProcedure
    .input(z.object({ code: z.string().min(1).max(32) }))
    .mutation(({ input }) => applyPromo(input.code)),

  upgrade: publicProcedure
    .input(z.object({ planId: planEnum, method: methodEnum }))
    .mutation(({ input }) => createUpgradeCheckout(input.planId, input.method)),

  diagnose: publicProcedure
    .input(z.object({ accountId: z.string().min(1) }))
    .query(({ input }) => diagnoseAccount(input.accountId)),
});
