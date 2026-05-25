import { z } from "zod";

import { mediaTypeSchema, planTierSchema, platformSchema, uuidSchema } from "./primitives.js";

export const createOrgSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "slug: только строчные буквы, цифры и дефис"),
});
export type CreateOrgInput = z.infer<typeof createOrgSchema>;

export const socialAccountCredentialsSchema = z.object({
  password: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  cookies: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
});
export type SocialAccountCredentialsInput = z.infer<typeof socialAccountCredentialsSchema>;

export const addSocialAccountSchema = z.object({
  platform: platformSchema,
  username: z.string().min(1, "username обязателен").max(100),
  credentials: socialAccountCredentialsSchema.optional(),
});
export type AddSocialAccountInput = z.infer<typeof addSocialAccountSchema>;

export const uploadMediaSchema = z.object({
  type: mediaTypeSchema,
  fileName: z.string().min(1),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(500 * 1024 * 1024, "Файл не больше 500 МБ"),
  durationSec: z.number().int().positive().optional(),
});
export type UploadMediaInput = z.infer<typeof uploadMediaSchema>;

export const createContentJobSchema = z.object({
  sourceAssetId: uuidSchema,
  preset: z.record(z.string(), z.unknown()).optional(),
});
export type CreateContentJobInput = z.infer<typeof createContentJobSchema>;

export const createPostingJobSchema = z.object({
  accountId: uuidSchema,
  assetId: uuidSchema,
  caption: z.string().max(2200).optional(),
  scheduledAt: z.coerce.date(),
});
export type CreatePostingJobInput = z.infer<typeof createPostingJobSchema>;

export const updateSubscriptionSchema = z.object({
  planId: z.string().min(1),
  tier: planTierSchema,
});
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
