import { z } from "zod";

import { getSettings, LANGUAGES, THEMES, updateSettings } from "../data/settings.js";
import { publicProcedure, router } from "../trpc.js";

export const settingsRouter = router({
  get: publicProcedure.query(() => getSettings()),
  update: publicProcedure
    .input(
      z.object({
        displayName: z.string().min(1).max(64).optional(),
        language: z.enum(LANGUAGES).optional(),
        theme: z.enum(THEMES).optional(),
        defaultPlatform: z.string().min(1).max(32).optional(),
        emailNotifications: z.boolean().optional(),
      }),
    )
    .mutation(({ input }) => updateSettings(input)),
});
