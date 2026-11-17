import type { CustomerTier, CustomerTierChange, EpochMs } from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";
import type { CountedRedemption } from "../../domain/policies/tier-window.policy";

/** A customer's standing as the read side shows it. */
export interface StoredTierStanding {
	readonly tier: CustomerTier;
	readonly countedRedemptions: number;
	readonly holdUntil: EpochMs | null;
	readonly warning: { readonly toTier: CustomerTier; readonly dueAt: EpochMs } | null;
	readonly evaluatedAt: EpochMs;
}

/** How many customers stand above Bronze at each tier, and how many customers there are at all. */
export interface StoredTierDistribution {
	readonly aboveBronze: ReadonlyMap<CustomerTier, number>;
	/** Everyone who has claimed at a store (a customer of at least one merchant). */
	readonly customers: number;
}

/** The tiers context's reads (ADR 085), each under `tiers.standing.read` after the caller's own check. */
export interface TierReadPort {
	standingOf(actor: ActorContext, userId: string): Promise<StoredTierStanding | null>;
	/** The customer's tier history, newest first, at most `limit` changes. */
	historyOf(actor: ActorContext, userId: string, limit: number): Promise<readonly CustomerTierChange[]>;
	/** The customer's counted redemptions made after `since`, oldest first. */
	countedSince(actor: ActorContext, userId: string, since: EpochMs): Promise<readonly CountedRedemption[]>;
	/** Each merchant's name. */
	tenantNames(actor: ActorContext, tenantIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
	distribution(actor: ActorContext): Promise<StoredTierDistribution>;
	/** Each customer's stored tier; a customer without a standing is left out (Bronze). */
	storedTiersOf(userIds: readonly string[]): Promise<ReadonlyMap<string, CustomerTier>>;
}
