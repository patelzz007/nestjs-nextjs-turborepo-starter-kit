import type { EpochMs, JsonObject, LocationScopeType, RewardFreeItem, RewardResponse, RewardType } from "@workspace/shared";

import type { TenantStoreFacts } from "../../domain/policies/reward-location-scope.policy";

/** Locks the files a reward is about to show and checks each is usable (bound to one transaction). */
export interface RewardImageFilesPort {
	/**
	 * Row-locks every file until commit and checks it is this tenant's READY, published,
	 * live reward image; throws `RewardImagesInvalidError` otherwise. No ids: nothing to do.
	 * File deletion takes the same lock, so an image cannot be deleted while a save names it.
	 */
	lockUsable(tenantId: string, fileIds: readonly string[]): Promise<void>;
}

/** The tenant's stores, as a reward's store scope needs them (bound to one transaction). */
export interface TenantStoresPort {
	factsFor(tenantId: string, requestedLocationIds: readonly string[]): Promise<TenantStoreFacts>;
}

/** A reward as the API returns it, read inside the command's own transaction. */
export interface RewardViewPort {
	getResponse(rewardId: string): Promise<RewardResponse>;
}

/** One append to the rewards-family audit trail (`RewardAuditLog`). */
export interface RewardAuditEntry {
	readonly tenantId: string | null;
	/** The human who caused it; null for machines (API keys, jobs). */
	readonly actorUserId: string | null;
	/** Stable action name, e.g. `reward.approved`, `merchant.checkout`. */
	readonly action: string;
	readonly metadata: JsonObject;
}

/** Appends to the rewards-family audit trail inside the caller's transaction (claims, pos and referrals use it too). */
export interface RewardAuditPort {
	append(entry: RewardAuditEntry): Promise<void>;
}

/** Whether a customer accepted the rewards terms (claims checks it before a claim). */
export interface LegalAcceptanceCheck {
	hasAccepted(userId: string): Promise<boolean>;
}

/** What a till needs to know about the reward behind a presented claim code. */
/** What a reward gives, as a redemption reports it to the till (ADR 074). */
export interface RewardOfferFacts {
	readonly rewardType: RewardType;
	/** Percent off, whole-currency cashback, points, or the number of items given (by type). */
	readonly rewardValue: number;
	/** The item a `FREE_ITEM` / `BOGO` reward gives; null for every other type. */
	readonly freeItem: RewardFreeItem | null;
}

export interface RewardRedemptionFacts {
	readonly id: string;
	readonly tenantId: string;
	readonly title: string;
	readonly description: string;
	readonly rewardType: RewardType;
	readonly offer: RewardOfferFacts;
	readonly termsConditions: string | null;
	readonly expiryDate: EpochMs;
	readonly locationScopeType: LocationScopeType;
	/** The live stores a `SELECTED` reward is valid at (empty for `ALL_LOCATIONS`). */
	readonly locationIds: readonly string[];
	/** Minimum bill in minor units; null = no minimum. */
	readonly minSpendMinor: number | null;
}

/** A redeemed reward as a sale's receipt names it: its title and what it gave. */
export interface RedeemedRewardFacts {
	readonly title: string;
	readonly offer: RewardOfferFacts;
}

/** Redemption facts of rewards (pos asks through claims' redemption port). */
export interface RewardRedemptionFactsPort {
	/** The live reward's facts; null when it is gone. */
	factsFor(rewardId: string): Promise<RewardRedemptionFacts | null>;

	/** The rewards' titles and offers (soft-deleted ones included: a recorded sale keeps naming what it redeemed), one query for all. */
	redeemedRewardsOf(rewardIds: readonly string[]): Promise<ReadonlyMap<string, RedeemedRewardFacts>>;
}
