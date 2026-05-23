import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { EncryptedBlob } from "@avastudio/shared";

// ───────────────────────── Enums ─────────────────────────
export const orgRole = pgEnum("org_role", ["owner", "admin", "editor", "viewer"]);
export const subscriptionStatus = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
]);
export const planTier = pgEnum("plan_tier", ["b2c", "b2b"]);
export const platform = pgEnum("platform", [
  "instagram",
  "tiktok",
  "reddit",
  "threads",
  "youtube",
  "x",
]);
export const accountStatus = pgEnum("account_status", [
  "pending",
  "warming_up",
  "active",
  "checkpoint",
  "banned",
  "disabled",
]);
export const phoneProvider = pgEnum("phone_provider", [
  "duoplus",
  "geelark",
  "morelogin",
  "bluestacks",
]);
export const proxyProvider = pgEnum("proxy_provider", ["brightdata", "iproyal", "smartproxy"]);
export const mediaType = pgEnum("media_type", ["video", "image", "audio"]);
export const jobStatus = pgEnum("job_status", [
  "queued",
  "processing",
  "completed",
  "failed",
  "canceled",
]);
export const paymentProvider = pgEnum("payment_provider", [
  "stripe",
  "paddle",
  "lemonsqueezy",
  "crypto",
]);
export const paymentEventType = pgEnum("payment_event_type", [
  "subscription_created",
  "subscription_updated",
  "subscription_canceled",
  "payment_succeeded",
  "payment_failed",
]);

// ──────────────────── Пользователи и организации ────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("organizations_created_by_idx").on(t.createdBy)],
);

export const orgMembers = pgTable(
  "org_members",
  {
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: orgRole("role").notNull().default("viewer"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] }), index("org_members_user_idx").on(t.userId)],
);

// Хранилище обёрнутых DEK (envelope encryption, ADR-009)
export const organizationDataKeys = pgTable(
  "organization_data_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    wrappedDek: jsonb("wrapped_dek").$type<EncryptedBlob>().notNull(),
    keyVersion: text("key_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("org_data_keys_org_idx").on(t.orgId)],
);

// ──────────────────────── Биллинг ────────────────────────
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: paymentProvider("provider").notNull(),
    externalId: text("external_id"),
    planId: text("plan_id").notNull(),
    tier: planTier("tier").notNull(),
    status: subscriptionStatus("status").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("subscriptions_org_idx").on(t.orgId),
    uniqueIndex("subscriptions_external_idx").on(t.externalId),
  ],
);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    metric: text("metric").notNull(),
    amount: integer("amount").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("usage_events_org_created_idx").on(t.orgId, t.createdAt),
    index("usage_events_org_metric_idx").on(t.orgId, t.metric),
  ],
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: paymentProvider("provider").notNull(),
    externalEventId: text("external_event_id").notNull(),
    type: paymentEventType("type").notNull(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
    payload: jsonb("payload"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex("payment_events_provider_event_idx").on(t.provider, t.externalEventId)],
);

// ────────────────── Соцаккаунты, прокси, телефоны ──────────────────
export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    platform: platform("platform").notNull(),
    username: text("username").notNull(),
    status: accountStatus("status").notNull().default("pending"),
    credentialsEncrypted: jsonb("credentials_encrypted").$type<EncryptedBlob>(),
    healthScore: integer("health_score").notNull().default(100),
    warmupStage: integer("warmup_stage").notNull().default(0),
    warmupStartedAt: timestamp("warmup_started_at", { withTimezone: true }),
    lastCheckpointAt: timestamp("last_checkpoint_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("social_accounts_org_idx").on(t.orgId),
    index("social_accounts_org_platform_idx").on(t.orgId, t.platform),
    uniqueIndex("social_accounts_org_platform_username_idx").on(t.orgId, t.platform, t.username),
  ],
);

export const proxies = pgTable(
  "proxies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: proxyProvider("provider").notNull(),
    host: text("host"),
    port: integer("port"),
    credentialsEncrypted: jsonb("credentials_encrypted").$type<EncryptedBlob>(),
    stickySessionId: text("sticky_session_id"),
    successCount: integer("success_count").notNull().default(0),
    failCount: integer("fail_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("proxies_org_idx").on(t.orgId)],
);

export const phones = pgTable(
  "phones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: phoneProvider("provider").notNull(),
    deviceId: text("device_id").notNull(),
    status: text("status").notNull().default("idle"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("phones_org_idx").on(t.orgId),
    uniqueIndex("phones_provider_device_idx").on(t.provider, t.deviceId),
  ],
);

export const accountPhoneBindings = pgTable(
  "account_phone_bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
    phoneId: uuid("phone_id")
      .notNull()
      .references(() => phones.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("account_phone_account_idx").on(t.accountId),
    index("account_phone_phone_idx").on(t.phoneId),
  ],
);

// ───────────────────────── Медиа ─────────────────────────
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    type: mediaType("type").notNull(),
    storagePath: text("storage_path").notNull(),
    durationSec: integer("duration_sec"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    width: integer("width"),
    height: integer("height"),
    probeData: jsonb("probe_data"),
    tags: text("tags").array(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("media_assets_org_idx").on(t.orgId),
    index("media_assets_org_type_idx").on(t.orgId, t.type),
  ],
);

export const contentJobs = pgTable(
  "content_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceAssetId: uuid("source_asset_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    preset: jsonb("preset"),
    status: jobStatus("status").notNull().default("queued"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("content_jobs_org_idx").on(t.orgId), index("content_jobs_status_idx").on(t.status)],
);

export const mediaVariants = pgTable(
  "media_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    sourceId: uuid("source_id").references(() => mediaAssets.id, { onDelete: "cascade" }),
    platform: platform("platform"),
    outputPath: text("output_path").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("media_variants_source_idx").on(t.sourceId),
    index("media_variants_org_idx").on(t.orgId),
  ],
);

export const renderMetrics = pgTable(
  "render_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentJobId: uuid("content_job_id").references(() => contentJobs.id, { onDelete: "set null" }),
    jobId: text("job_id"),
    inputDurationSec: integer("input_duration_sec"),
    renderDurationMs: integer("render_duration_ms"),
    outputSizeBytes: bigint("output_size_bytes", { mode: "number" }),
    outputResolution: text("output_resolution"),
    presetChain: text("preset_chain").array(),
    exitCode: integer("exit_code"),
    encoder: text("encoder"),
    workerId: text("worker_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("render_metrics_created_idx").on(t.createdAt)],
);

// ──────────────────────── Постинг ────────────────────────
export const postingSchedules = pgTable(
  "posting_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    rules: jsonb("rules"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("posting_schedules_org_idx").on(t.orgId)],
);

export const postingJobs = pgTable(
  "posting_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => socialAccounts.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    scheduleId: uuid("schedule_id").references(() => postingSchedules.id, { onDelete: "set null" }),
    caption: text("caption"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: jobStatus("status").notNull().default("queued"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("posting_jobs_org_idx").on(t.orgId),
    index("posting_jobs_scheduled_idx").on(t.scheduledAt),
    index("posting_jobs_account_scheduled_idx").on(t.accountId, t.scheduledAt),
    index("posting_jobs_status_idx").on(t.status),
  ],
);

export const postResults = pgTable(
  "post_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postingJobId: uuid("posting_job_id")
      .notNull()
      .references(() => postingJobs.id, { onDelete: "cascade" }),
    platformPostId: text("platform_post_id"),
    success: boolean("success").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("post_results_job_idx").on(t.postingJobId)],
);

// ───────────────────────── Аудит ─────────────────────────
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: jsonb("metadata"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_log_org_created_idx").on(t.orgId, t.createdAt),
    index("audit_log_user_idx").on(t.userId),
  ],
);

// ──────────────────── Экспорт типов (select/insert) ────────────────────
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type OrgMember = typeof orgMembers.$inferSelect;
export type NewOrgMember = typeof orgMembers.$inferInsert;
export type OrganizationDataKey = typeof organizationDataKeys.$inferSelect;
export type NewOrganizationDataKey = typeof organizationDataKeys.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type NewUsageEvent = typeof usageEvents.$inferInsert;
export type PaymentEvent = typeof paymentEvents.$inferSelect;
export type NewPaymentEvent = typeof paymentEvents.$inferInsert;
export type SocialAccount = typeof socialAccounts.$inferSelect;
export type NewSocialAccount = typeof socialAccounts.$inferInsert;
export type Proxy = typeof proxies.$inferSelect;
export type NewProxy = typeof proxies.$inferInsert;
export type Phone = typeof phones.$inferSelect;
export type NewPhone = typeof phones.$inferInsert;
export type AccountPhoneBinding = typeof accountPhoneBindings.$inferSelect;
export type NewAccountPhoneBinding = typeof accountPhoneBindings.$inferInsert;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;
export type ContentJob = typeof contentJobs.$inferSelect;
export type NewContentJob = typeof contentJobs.$inferInsert;
export type MediaVariant = typeof mediaVariants.$inferSelect;
export type NewMediaVariant = typeof mediaVariants.$inferInsert;
export type RenderMetric = typeof renderMetrics.$inferSelect;
export type NewRenderMetric = typeof renderMetrics.$inferInsert;
export type PostingSchedule = typeof postingSchedules.$inferSelect;
export type NewPostingSchedule = typeof postingSchedules.$inferInsert;
export type PostingJob = typeof postingJobs.$inferSelect;
export type NewPostingJob = typeof postingJobs.$inferInsert;
export type PostResult = typeof postResults.$inferSelect;
export type NewPostResult = typeof postResults.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
