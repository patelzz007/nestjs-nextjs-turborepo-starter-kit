import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/** What one nightly review did. */
export interface TierReviewResult {
	readonly reviewed: number;
	readonly failed: number;
}

/** Customers the nightly review reads per page; it pages until none are left. */
export const TIER_REVIEW_PAGE_SIZE = 200;

/** How far back the nightly review looks for redemptions whose promotion may have been missed: two days, so a night's review never misses one. */
export const TIER_REVIEW_RECENT_DAYS = 2;

/**
 * The nightly tier review (ADR 085): every customer above Bronze and everyone who redeemed lately, each in their own
 * transaction under their row lock — missed promotions, demotion warnings, demotions due, warnings no longer needed, and
 * changed rules applied.
 */
export class ReviewCustomerTiersCommand extends Command<TierReviewResult> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
