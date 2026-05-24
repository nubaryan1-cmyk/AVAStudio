/** Брендированные идентификаторы — чтобы не перепутать id разных сущностей. */
export type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, "UserId">;
export type OrgId = Brand<string, "OrgId">;
export type SocialAccountId = Brand<string, "SocialAccountId">;
export type ProxyId = Brand<string, "ProxyId">;
export type PhoneId = Brand<string, "PhoneId">;
export type MediaAssetId = Brand<string, "MediaAssetId">;
export type ContentJobId = Brand<string, "ContentJobId">;
export type PostingJobId = Brand<string, "PostingJobId">;
export type SubscriptionId = Brand<string, "SubscriptionId">;

export const asUserId = (v: string): UserId => v as UserId;
export const asOrgId = (v: string): OrgId => v as OrgId;
export const asSocialAccountId = (v: string): SocialAccountId => v as SocialAccountId;
export const asProxyId = (v: string): ProxyId => v as ProxyId;
export const asPhoneId = (v: string): PhoneId => v as PhoneId;
export const asMediaAssetId = (v: string): MediaAssetId => v as MediaAssetId;
export const asContentJobId = (v: string): ContentJobId => v as ContentJobId;
export const asPostingJobId = (v: string): PostingJobId => v as PostingJobId;
export const asSubscriptionId = (v: string): SubscriptionId => v as SubscriptionId;
