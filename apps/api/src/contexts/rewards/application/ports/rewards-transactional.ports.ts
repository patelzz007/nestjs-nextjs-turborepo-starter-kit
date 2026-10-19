import type { EpochMs, JsonObject, OrganizationLocationScopeType, RewardResponse, RewardType } from "@workspace/shared";

import type { OrganizationStoreFacts } from "../../domain/policies/reward-location-scope.policy";

/** Locks the files a reward is about to show and checks each is usable (bound to one transaction). */
export interface RewardImageFilesPort {
	/**
	 * Row-locks every file until commit and checks it is this organization's READY, published,
	 * live reward image; throws `RewardImagesInvalidError` otherwise. No ids: nothing to do.
	 * File deletion takes the same lock, so an image cannot be deleted while a save names it.
	 */
	lockUsable(organizationId: string, fileIds: readonly string[]): Promise<void>;
}

/** The organization's stores, as a reward's store scope needs them (bound to one transaction). */
export interface OrganizationStoresPort {
	factsFor(organizationId: string, requestedLocationIds: readonly string[]): Promise<OrganizationStoreFacts>;
}

/** A reward as the API returns it, read inside the command's own transaction. */
export interface RewardViewPort {
	getResponse(rewardId: string): Promise<RewardResponse>;
}

/** One append to the rewards-family audit trail (`RewardAuditLog`). */
export interface RewardAuditEntry {
	readonly organizationId: string | null;
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
export interface RewardRedemptionFacts {
	readonly id: string;
	readonly organizationId: string;
	readonly title: string;
	readonly rewardType: RewardType;
	readonly expiryDate: EpochMs;
	readonly locationScopeType: OrganizationLocationScopeType;
	/** The live stores a `SELECTED` reward is valid at (empty for `ALL_LOCATIONS`). */
	readonly locationIds: readonly string[];
	/** Minimum bill in minor units; null = no minimum. */
	readonly minSpendMinor: number | null;
}

/** Redemption facts of rewards (pos asks through claims' redemption port). */
export interface RewardRedemptionFactsPort {
	/** The live reward's facts; null when it is gone. */
	factsFor(rewardId: string): Promise<RewardRedemptionFacts | null>;

	/** Titles of the rewards (soft-deleted ones included: a recorded sale keeps naming what it redeemed), one query for all. */
	titlesOf(rewardIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
}
