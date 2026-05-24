import type {
  AccountStatus,
  JobStatus,
  MediaType,
  OrgRole,
  Platform,
  PlanTier,
  SubscriptionStatus,
} from "./enums.js";
import type {
  ContentJobId,
  MediaAssetId,
  OrgId,
  PostingJobId,
  SocialAccountId,
  SubscriptionId,
  UserId,
} from "./ids.js";

/** Доменные модели (app-facing). Не содержат зашифрованных кредов — это server-only слой. */

export interface User {
  id: UserId;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: OrgId;
  name: string;
  slug: string;
  createdBy: UserId | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgMembership {
  orgId: OrgId;
  userId: UserId;
  role: OrgRole;
  createdAt: Date;
}

export interface SocialAccount {
  id: SocialAccountId;
  orgId: OrgId;
  platform: Platform;
  username: string;
  status: AccountStatus;
  healthScore: number;
  warmupStage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaAsset {
  id: MediaAssetId;
  orgId: OrgId;
  type: MediaType;
  storagePath: string;
  durationSec: number | null;
  createdAt: Date;
}

export interface ContentJob {
  id: ContentJobId;
  orgId: OrgId;
  sourceAssetId: MediaAssetId | null;
  status: JobStatus;
  createdAt: Date;
}

export interface PostingJob {
  id: PostingJobId;
  orgId: OrgId;
  accountId: SocialAccountId;
  scheduledAt: Date;
  status: JobStatus;
  createdAt: Date;
}

export interface Subscription {
  id: SubscriptionId;
  orgId: OrgId;
  planId: string;
  tier: PlanTier;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
}
