import { z } from "zod";

import {
  generateImageAsset,
  generateMusicAsset,
  generateTtsAsset,
} from "../data/generation.js";
import { publicProcedure, router } from "../trpc.js";

export const generationRouter = router({
  image: publicProcedure
    .input(z.object({ prompt: z.string().min(1).max(1000) }))
    .mutation(({ input }) => generateImageAsset(input.prompt)),

  tts: publicProcedure
    .input(z.object({ text: z.string().min(1).max(2000) }))
    .mutation(({ input }) => generateTtsAsset(input.text)),

  music: publicProcedure
    .input(z.object({ prompt: z.string().min(1).max(1000), durationSec: z.number().int().min(5).max(300) }))
    .mutation(({ input }) => generateMusicAsset(input.prompt, input.durationSec)),
});
