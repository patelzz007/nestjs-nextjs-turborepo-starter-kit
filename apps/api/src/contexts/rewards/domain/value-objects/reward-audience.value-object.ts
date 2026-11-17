import { ENTRY_CUSTOMER_TIER, type CustomerTier, type RewardAudienceType } from "@workspace/shared";

import { reachesMinimumTier, type CustomerTierAccess } from "../../../../platform/domain/customer-tier-access";
import { RewardMinimumTierInvalidError } from "../errors/reward.errors";

/**
 * Who may see and claim a reward: everyone, or exactly the tenant's customers it was given to (unique ids, in the order
 * they were chosen). A reward for everyone may also name a minimum tier (ADR 085): customers below it see it locked and
 * cannot claim it. A reward for chosen customers is open to them at any tier (its minimum is always Bronze).
 */
export class RewardAudience {
	private constructor(
		public readonly type: RewardAudienceType,
		public readonly customerIds: readonly string[],
		public readonly minimumTier: CustomerTier,
	) {}

	public static everyone(minimumTier: CustomerTier = ENTRY_CUSTOMER_TIER): RewardAudience {
		return new RewardAudience("EVERYONE", [], minimumTier);
	}

	public static selected(customerIds: readonly string[]): RewardAudience {
		return new RewardAudience("SELECTED_CUSTOMERS", [...new Set(customerIds)], ENTRY_CUSTOMER_TIER);
	}

	/** Stored columns: a `SELECTED_CUSTOMERS` reward lists its customers; an `EVERYONE` reward has none and may name a minimum tier. */
	public static fromStorage(type: RewardAudienceType, customerIds: readonly string[], minimumTier: CustomerTier): RewardAudience {
		return type === "EVERYONE" ? RewardAudience.everyone(minimumTier) : RewardAudience.selected(customerIds).withMinimumTier(minimumTier);
	}

	public get isEveryone(): boolean {
		return this.type === "EVERYONE";
	}

	/** Whether claiming is narrowed by tier (anything above Bronze). */
	public get narrowsByTier(): boolean {
		return this.minimumTier !== ENTRY_CUSTOMER_TIER;
	}

	/** Whether `userId` (null = someone not signed in) may see the reward (a reward locked by tier is still seen). */
	public includes(userId: string | null): boolean {
		return this.isEveryone || (userId !== null && this.customerIds.includes(userId));
	}

	/** Whether a viewer with `access` reaches the reward's minimum tier (always, while tiers are off). */
	public isOpenTo(access: CustomerTierAccess): boolean {
		return reachesMinimumTier(access, this.minimumTier);
	}

	/** The same audience with another minimum tier; refused above Bronze for chosen customers. */
	public withMinimumTier(minimumTier: CustomerTier): RewardAudience {
		if (!this.isEveryone && minimumTier !== ENTRY_CUSTOMER_TIER) {
			throw new RewardMinimumTierInvalidError("chosen_customers");
		}
		return new RewardAudience(this.type, this.customerIds, minimumTier);
	}

	public equals(other: RewardAudience): boolean {
		return (
			this.type === other.type &&
			this.minimumTier === other.minimumTier &&
			this.customerIds.length === other.customerIds.length &&
			this.customerIds.every((customerId, position) => other.customerIds.at(position) === customerId)
		);
	}
}
