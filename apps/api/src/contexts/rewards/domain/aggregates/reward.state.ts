import type { EpochMs, RewardType } from "@workspace/shared";

import type { RewardLocationScope } from "../value-objects/reward-location-scope.value-object";
import type { RewardRulesValue } from "../value-objects/reward-rules.value-object";
import type { RewardKindValue, RewardLifecycleStatus } from "../value-objects/reward-status.value-object";

/** The offer terms a referrer child mirrors from its consumer reward. */
export interface RewardOffer {
	readonly rewardType: RewardType;
	readonly rewardValue: number;
	readonly termsConditions: string | null;
	readonly category: string;
}

/** Stock counters of one reward row. */
export interface RewardInventoryCounts {
	readonly quantityTotal: number;
	readonly quantityRemaining: number;
	readonly quantityReserved: number;
	readonly claimCount: number;
	readonly redemptionCount: number;
}

/** Review timestamps that move with every lifecycle transition (on the reward and its referrer child alike). */
export interface RewardReviewState {
	readonly status: RewardLifecycleStatus;
	readonly submittedForReviewAt: EpochMs | null;
	readonly autoPublishAt: EpochMs | null;
	readonly reviewedAt: EpochMs | null;
	readonly reviewedByUserId: string | null;
}

/** One stored reward row as a command load reads it, before its status is validated. */
export interface RewardRowState {
	readonly id: string;
	readonly kind: RewardKindValue;
	/** Raw stored status; the aggregate accepts only the statuses it models. */
	readonly status: string;
	readonly title: string;
	readonly description: string;
	readonly offer: RewardOffer;
	readonly startDate: EpochMs | null;
	readonly expiryDate: EpochMs;
	readonly inventory: RewardInventoryCounts;
	readonly submittedForReviewAt: EpochMs | null;
	readonly autoPublishAt: EpochMs | null;
	readonly reviewedAt: EpochMs | null;
	readonly reviewedByUserId: string | null;
	readonly updatedAt: EpochMs;
}

/** A reward as loaded for a command: the row, its tenant-level settings, and its referrer child. */
export interface RewardState extends RewardRowState {
	readonly tenantId: string;
	readonly rules: RewardRulesValue;
	readonly rejectionReason: string | null;
	readonly referralsEnabled: boolean;
	readonly referralPoolTotal: number | null;
	readonly referralPoolRemaining: number | null;
	readonly locationScope: RewardLocationScope;
	/** Live images in display order (position 0 is the cover). */
	readonly imageFileIds: readonly string[];
	/** Tenant-wide, or at least one of its stores is live and active — otherwise nothing can be claimed. */
	readonly availableAtActiveStore: boolean;
	/** The referrer bonus a consumer reward's referrals earn; always null for a referrer row itself. */
	readonly referrer: RewardRowState | null;
}

/** A referrer child as persisted after a command. */
export interface ReferrerRewardSnapshot {
	readonly id: string;
	readonly title: string;
	readonly description: string;
	readonly offer: RewardOffer;
	readonly expiryDate: EpochMs;
	readonly inventory: RewardInventoryCounts;
	readonly review: RewardReviewState;
	readonly updatedAt: EpochMs;
}

/** A reward as persisted after a command. */
export interface RewardSnapshot {
	readonly id: string;
	readonly kind: RewardKindValue;
	readonly tenantId: string;
	readonly title: string;
	readonly description: string;
	readonly offer: RewardOffer;
	readonly rules: RewardRulesValue;
	readonly startDate: EpochMs | null;
	readonly expiryDate: EpochMs;
	readonly inventory: RewardInventoryCounts;
	readonly review: RewardReviewState;
	readonly rejectionReason: string | null;
	readonly referralsEnabled: boolean;
	readonly referralPoolTotal: number | null;
	readonly referralPoolRemaining: number | null;
	readonly locationScope: RewardLocationScope;
	readonly imageFileIds: readonly string[];
	readonly updatedAt: EpochMs;
	readonly referrer: ReferrerRewardSnapshot | null;
}

/** What a merchant asked to change; absent fields stay as they are. */
export interface RewardRevision {
	readonly title?: string | undefined;
	readonly description?: string | undefined;
	readonly rewardType?: RewardType | undefined;
	readonly rewardValue?: number | undefined;
	readonly termsConditions?: string | null | undefined;
	readonly imageFileIds?: readonly string[] | undefined;
	readonly quantityTotal?: number | undefined;
	readonly startDate?: EpochMs | null | undefined;
	readonly expiryDate?: EpochMs | undefined;
	readonly referralsEnabled?: boolean | undefined;
	readonly referralPoolTotal?: number | undefined;
	readonly referrerRewardTitle?: string | undefined;
	readonly rules?: RewardRulesValue | undefined;
}

/** Everything a new consumer reward is created from. */
export interface NewRewardDefinition {
	readonly id: string;
	/** Id for the referrer child, used only when referrals are enabled with a pool. */
	readonly referrerId: string;
	readonly tenantId: string;
	readonly title: string;
	readonly description: string;
	readonly offer: RewardOffer;
	readonly rules: RewardRulesValue;
	readonly quantityTotal: number;
	readonly startDate: EpochMs | null;
	readonly expiryDate: EpochMs;
	readonly referralsEnabled: boolean;
	/** Required when referrals are enabled (the contract enforces it); ignored otherwise. */
	readonly referralPoolTotal: number | null;
	readonly referrerRewardTitle: string | null;
	readonly saveAsDraft: boolean;
	readonly locationScope: RewardLocationScope;
	readonly imageFileIds: readonly string[];
}

/** What a claim needs to know about a claimable reward. */
export interface ClaimableRewardFacts {
	readonly rewardId: string;
	readonly tenantId: string;
	readonly title: string;
	readonly expiryDate: EpochMs;
	/** `rules.maxUsePerUser`; null = unlimited. */
	readonly maxClaimsPerUser: number | null;
}

/** The referrer bonus one credited referral earned: the reward the referrer's credit claim is for. */
export interface ReferrerCreditFacts {
	readonly referrerRewardId: string;
	readonly title: string;
	/** The credit claim never outlives it. */
	readonly expiryDate: EpochMs;
}
