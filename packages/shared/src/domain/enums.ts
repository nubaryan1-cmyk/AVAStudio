/** Единые перечисления домена (зеркалят enum'ы БД из @avastudio/db). */

export const PLATFORMS = ["instagram", "tiktok", "reddit", "threads", "youtube", "x"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const ORG_ROLES = ["owner", "admin", "editor", "viewer"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ACCOUNT_STATUSES = [
  "pending",
  "warming_up",
  "active",
  "checkpoint",
  "banned",
  "disabled",
] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const JOB_STATUSES = ["queued", "processing", "completed", "failed", "canceled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const PLAN_TIERS = ["b2c", "b2b"] as const;
export type PlanTier = (typeof PLAN_TIERS)[number];

export const MEDIA_TYPES = ["video", "image", "audio"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const PAYMENT_PROVIDERS = ["stripe", "paddle", "lemonsqueezy", "crypto"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];
