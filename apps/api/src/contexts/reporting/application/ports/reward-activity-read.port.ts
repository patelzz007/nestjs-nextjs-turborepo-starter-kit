import type { RewardClaimStatus } from "@workspace/shared";

import type { AnalyticsLocationScope } from "../../domain/value-objects/analytics-scope.value-object";
import type { InclusiveRange } from "./sales-read.port";

/** Which of an organization's consumer rewards to count (all of them when no range is given). */
export interface RewardCountFilter {
	readonly organizationId: string;
	/** Only rewards offered at a store of this scope (organization-wide rewards count for every store). */
	readonly locationScope: AnalyticsLocationScope;
	/** Only PUBLISHED rewards. */
	readonly publishedOnly: boolean;
	/** Only rewards created in this range. */
	readonly createdIn?: InclusiveRange | undefined;
	/** Only rewards reviewed (approved or auto-published) in this range. */
	readonly reviewedIn?: InclusiveRange | undefined;
}

/** One count over the requested period and over the equally long period before it (both bounds inclusive). */
export interface PeriodCounts {
	readonly current: number;
	readonly previous: number;
}

/** The requested period and the one before it; weeks start Monday 00:00 in `timeZone`. */
export interface ComparedPeriods {
	readonly current: InclusiveRange;
	readonly previous: InclusiveRange;
	readonly timeZone: string;
}

/** Claims and redemptions in one week of the current period (only weeks with activity are returned). */
export interface ActivityWeek {
	readonly weekStartMs: number;
	readonly claims: number;
	readonly redemptions: number;
}

/** One reward's claims and redemptions in the current period. */
export interface RewardActivityCounts {
	readonly rewardId: string;
	readonly claims: number;
	readonly redemptions: number;
}

/** A merchant's claim and redemption activity, counted by the database (never one row per claim). */
export interface MerchantActivity {
	readonly claims: PeriodCounts;
	readonly redemptions: PeriodCounts;
	readonly weeks: readonly ActivityWeek[];
	/** The most active rewards of the current period, most claims + redemptions first (ties by reward id). */
	readonly topRewards: readonly RewardActivityCounts[];
}

/** A customer's own claim and referral activity, counted by the database. */
export interface CustomerActivity {
	readonly claimsByStatus: Readonly<Record<RewardClaimStatus, PeriodCounts>>;
	/** Claims per week by `claimedAt`; redemptions per week by `redeemedAt` of the current period's redeemed claims. */
	readonly weeks: readonly ActivityWeek[];
	readonly referralsSent: PeriodCounts;
	readonly referralsCredited: PeriodCounts;
}

export interface RewardTitle {
	readonly id: string;
	readonly title: string;
}

/** Reward, claim, redemption and referral facts for the weekly analytics (`GET …/analytics`, `GET /claims/analytics`). */
export interface RewardActivityReadPort {
	countRewards(filter: RewardCountFilter): Promise<number>;
	/**
	 * Claims of the organization's live rewards offered at a store of `locationScope`, and redemptions of
	 * live claims at its stores in `locationScope`: per period, per week and per reward (at most `topRewards`).
	 */
	merchantActivity(organizationId: string, periods: ComparedPeriods, locationScope: AnalyticsLocationScope, topRewards: number): Promise<MerchantActivity>;
	/** Referrals created in `range` for the organization's live rewards offered at a store of `locationScope`. */
	countMerchantReferrals(organizationId: string, range: InclusiveRange, locationScope: AnalyticsLocationScope): Promise<number>;
	/** Titles of the organization's rewards with these ids (soft-deleted included: they may still have claims). */
	listRewardTitles(organizationId: string, rewardIds: readonly string[]): Promise<RewardTitle[]>;
	/** One customer's live claims (per status and per week) and the live referrals they sent (sent and credited). */
	customerActivity(userId: string, periods: ComparedPeriods): Promise<CustomerActivity>;
}
