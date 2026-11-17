import { DEFAULT_TIER_RULES, type CustomerTier, type CustomerTierChange, type EpochMs, type TierRules, type TierSettingsResponse } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { Clock } from "../../../../../platform/application/clock.port";
import type { CountedRedemption } from "../../../domain/policies/tier-window.policy";
import type { StoredTierDistribution, StoredTierStanding, TierReadPort } from "../../ports/tier-reads.port";
import type { TierSettingsStore } from "../../ports/tier-settings.store";
import type { TiersAvailabilityPort } from "../../ports/tiers-availability.port";

/** The tiers context's reads over plain maps: every customer's standing, history and counted redemptions. */
export class InMemoryTierReads implements TierReadPort {
	public readonly standings = new Map<string, StoredTierStanding>();
	public readonly histories = new Map<string, readonly CustomerTierChange[]>();
	public readonly redemptions = new Map<string, readonly CountedRedemption[]>();
	public readonly names = new Map<string, string>();
	public stored: StoredTierDistribution = { aboveBronze: new Map(), customers: 0 };
	/** The `since` each `countedSince` call asked for. */
	public readonly countedSinceAsked: EpochMs[] = [];

	public standingOf(_actor: ActorContext, userId: string): Promise<StoredTierStanding | null> {
		return Promise.resolve(this.standings.get(userId) ?? null);
	}

	public historyOf(_actor: ActorContext, userId: string, limit: number): Promise<readonly CustomerTierChange[]> {
		return Promise.resolve((this.histories.get(userId) ?? []).slice(0, limit));
	}

	public countedSince(_actor: ActorContext, userId: string, since: EpochMs): Promise<readonly CountedRedemption[]> {
		this.countedSinceAsked.push(since);
		return Promise.resolve((this.redemptions.get(userId) ?? []).filter((redemption: CountedRedemption): boolean => redemption.redeemedAt > since));
	}

	public tenantNames(_actor: ActorContext, tenantIds: readonly string[]): Promise<ReadonlyMap<string, string>> {
		return Promise.resolve(new Map(tenantIds.flatMap((tenantId: string): [string, string][] => this.namePair(tenantId))));
	}

	public distribution(): Promise<StoredTierDistribution> {
		return Promise.resolve(this.stored);
	}

	public storedTiersOf(userIds: readonly string[]): Promise<ReadonlyMap<string, CustomerTier>> {
		return Promise.resolve(new Map(userIds.flatMap((userId: string): [string, CustomerTier][] => this.tierPair(userId))));
	}

	private namePair(tenantId: string): [string, string][] {
		const name = this.names.get(tenantId);
		return name === undefined ? [] : [[tenantId, name]];
	}

	private tierPair(userId: string): [string, CustomerTier][] {
		const standing = this.standings.get(userId);
		return standing === undefined ? [] : [[userId, standing.tier]];
	}
}

/** The `customer-tiers` flag, switched by the test. */
export class SwitchableTiersAvailability implements TiersAvailabilityPort {
	public on = true;

	public isOn(): Promise<boolean> {
		return Promise.resolve(this.on);
	}
}

/** The tier rules in force; only `rules()` is read by the read side. */
export class FixedTierSettings implements TierSettingsStore {
	public constructor(private readonly current: TierRules = DEFAULT_TIER_RULES) {}

	public rules(): Promise<TierRules> {
		return Promise.resolve(this.current);
	}

	public settings(): Promise<TierSettingsResponse> {
		return Promise.resolve({ ...this.current, reason: null, updatedAt: null, updatedByName: null });
	}

	public save(): Promise<TierSettingsResponse> {
		return this.settings();
	}
}

/** A clock stopped at `at`. */
export class StoppedClock implements Clock {
	public constructor(private readonly at: EpochMs) {}

	public now(): EpochMs {
		return this.at;
	}
}
