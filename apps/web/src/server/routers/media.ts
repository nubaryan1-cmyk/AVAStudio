import { MEDIA_TYPES } from "@avastudio/shared/domain";
import { z } from "zod";

import { addAsset, allTags, getAsset, listAssets } from "../data/media.js";
import { publicProcedure, router } from "../trpc.js";

const typeEnum = z.enum(MEDIA_TYPES);

export const mediaRouter = router({
  list: publicProcedure
    .input(
      z
        .object({
          type: typeEnum.optional(),
          search: z.string().max(128).optional(),
          tags: z.array(z.string()).optional(),
        })
        .optional(),
    )
    .query(({ input }) => listAssets(input ?? undefined)),

  byId: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => getAsset(input.id)),

  allTags: publicProcedure.query(() => allTags()),

  upload: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(128),
        type: typeEnum,
        sizeBytes: z.number().int().positive(),
        durationSec: z.number().min(0),
        width: z.number().int().min(0),
        height: z.number().int().min(0),
        fps: z.number().positive().optional(),
        tags: z.array(z.string().min(1).max(32)).max(16),
      }),
    )
    .mutation(({ input }) => addAsset(input)),
});
