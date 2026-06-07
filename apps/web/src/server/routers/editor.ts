import { z } from "zod";

import {
  buildPreview,
  enqueueRender,
  listPresets,
  listProfiles,
  syncBatch,
} from "../data/editor.js";
import { publicProcedure, router } from "../trpc.js";

const PROFILE_IDS = [
  "instagram-reels",
  "instagram-feed-4-5",
  "instagram-feed-1-1",
  "tiktok",
  "reddit",
  "threads",
] as const;
const profileEnum = z.enum(PROFILE_IDS);

export const editorRouter = router({
  presets: publicProcedure.query(() => listPresets()),
  profiles: publicProcedure.query(() => listProfiles()),

  preview: publicProcedure
    .input(
      z.object({
        sourceAssetId: z.string().min(1),
        presetIds: z.array(z.string()).max(16),
        seed: z.number().int().optional(),
      }),
    )
    .query(({ input }) => buildPreview(input)),

  enqueue: publicProcedure
    .input(
      z.object({
        sourceAssetId: z.string().min(1),
        presetIds: z.array(z.string()).max(16),
        profileIds: z.array(profileEnum).min(1).max(6),
        variants: z.number().int().min(1).max(20),
        seed: z.number().int().optional(),
      }),
    )
    .mutation(({ input }) => enqueueRender(input)),

  batch: publicProcedure
    .input(z.object({ batchId: z.string().min(1) }))
    .query(({ input }) => syncBatch(input.batchId)),
});
