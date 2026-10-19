import type { Readable } from "node:stream";

import type {
	AdminPendingRewardListQuery,
	AdminRewardImageDownloadResponse,
	EpochMs,
	MerchantRewardListQuery,
	MerchantRewardSummary,
	PaginatedServiceResult,
	RewardClaimCheckoutStatus,
	RewardListQuery,
	RewardResponse,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { MerchantAccessGrant } from "../../../../platform/application/ports/authorization.port";

/**
 * Reward projections for queries. Each method runs under the actor's own RLS session, except the
 * ones documented as cross-tenant: those back `@RlsBypass()` routes (the moderation queue and the
 * public marketplace) and read as the allowlisted `route.rls_bypass` operation, exactly as today.
 */
export interface RewardReadPort {
	/** One page of the organization's live consumer rewards available at a store of `grant`, newest first by default. */
	listOrganizationRewards(actor: ActorContext, grant: MerchantAccessGrant, query: MerchantRewardListQuery): Promise<PaginatedServiceResult<RewardResponse>>;

	/** Figures over every one of those rewards: the count in each status and the units still claimable. */
	summarizeOrganizationRewards(actor: ActorContext, grant: MerchantAccessGrant): Promise<MerchantRewardSummary>;

	/** One of them; null when it is not offered at any store of `grant` (answered as 404, never 403). */
	findOrganizationReward(actor: ActorContext, grant: MerchantAccessGrant, rewardId: string): Promise<RewardResponse | null>;

	/** Cross-tenant: one page of the moderation queue (oldest first). */
	listPendingReview(actor: ActorContext, query: AdminPendingRewardListQuery): Promise<PaginatedServiceResult<RewardResponse>>;

	/** Cross-tenant: one live consumer reward in full, whatever its status. */
	findConsumerForReview(actor: ActorContext, rewardId: string): Promise<RewardResponse | null>;

	/** Cross-tenant: published, in-stock, unexpired consumer rewards. */
	listMarketplace(actor: ActorContext, query: RewardListQuery): Promise<PaginatedServiceResult<RewardResponse>>;

	/** Cross-tenant: one published consumer reward. */
	findPublished(actor: ActorContext, rewardId: string): Promise<RewardResponse | null>;

	/**
	 * System: one page (at most `limit`) of pending consumer rewards whose review window has elapsed by
	 * `now`, in (`autoPublishAt`, id) order strictly after `after`, so a run pages through any backlog in
	 * bounded reads and never re-reads a reward it skipped.
	 */
	listDueForAutoPublish(actor: ActorContext, now: EpochMs, limit: number, after: DueForAutoPublish | null): Promise<readonly DueForAutoPublish[]>;
}

/** A reward due for auto-publishing, and the keyset position after it. */
export interface DueForAutoPublish {
	readonly rewardId: string;
	readonly autoPublishAt: EpochMs;
}

/** An archive a route streams back as an attachment. */
export interface RewardImagesArchive {
	readonly fileName: string;
	readonly contentType: string;
	readonly body: Readable;
}

/** Reviewers' access to a reward's original image uploads (cross-tenant, `@RlsBypass()` routes). */
export interface RewardImageDeliveryPort {
	/** A short-lived signed download URL of one READY image of a live consumer reward; null otherwise. */
	downloadUrl(actor: ActorContext, rewardId: string, fileId: string): Promise<AdminRewardImageDownloadResponse | null>;

	/** Every READY image of a live consumer reward in one ZIP; null when there is no such reward or no image. */
	archive(actor: ActorContext, rewardId: string): Promise<RewardImagesArchive | null>;
}

/** The signed-in customer's legal acceptance and verified phone, for the claim checkout. */
export interface LegalAcceptanceReadPort {
	checkoutStatus(actor: ActorContext, userId: string): Promise<RewardClaimCheckoutStatus>;
}
