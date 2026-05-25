import { z } from "zod";

import {
  ACCOUNT_STATUSES,
  JOB_STATUSES,
  MEDIA_TYPES,
  ORG_ROLES,
  PLAN_TIERS,
  PLATFORMS,
  SUBSCRIPTION_STATUSES,
} from "../domain/enums.js";

export const emailSchema = z.string().email("Некорректный email");
export const urlSchema = z.string().url("Некорректный URL");
export const uuidSchema = z.string().uuid("Ожидается UUID");

export const platformSchema = z.enum(PLATFORMS);
export const orgRoleSchema = z.enum(ORG_ROLES);
export const accountStatusSchema = z.enum(ACCOUNT_STATUSES);
export const jobStatusSchema = z.enum(JOB_STATUSES);
export const planTierSchema = z.enum(PLAN_TIERS);
export const mediaTypeSchema = z.enum(MEDIA_TYPES);
export const subscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES);

export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: uuidSchema.optional(),
});
export type Pagination = z.infer<typeof paginationSchema>;
