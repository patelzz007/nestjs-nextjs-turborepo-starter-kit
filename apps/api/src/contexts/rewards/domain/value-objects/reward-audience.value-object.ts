import type { RewardAudienceType } from "@workspace/shared";

/**
 * Who may see and claim a reward: everyone, or exactly the tenant's customers it was given to
 * (unique ids, in the order they were chosen).
 */
export class RewardAudience {
	private constructor(
		public readonly type: RewardAudienceType,
		public readonly customerIds: readonly string[],
	) {}

	public static everyone(): RewardAudience {
		return new RewardAudience("EVERYONE", []);
	}

	public static selected(customerIds: readonly string[]): RewardAudience {
		return new RewardAudience("SELECTED_CUSTOMERS", [...new Set(customerIds)]);
	}

	/** Stored columns: a `SELECTED_CUSTOMERS` reward lists its customers; an `EVERYONE` reward has none. */
	public static fromStorage(type: RewardAudienceType, customerIds: readonly string[]): RewardAudience {
		return type === "EVERYONE" ? RewardAudience.everyone() : RewardAudience.selected(customerIds);
	}

	public get isEveryone(): boolean {
		return this.type === "EVERYONE";
	}

	/** Whether `userId` (null = someone not signed in) may see and claim the reward. */
	public includes(userId: string | null): boolean {
		return this.isEveryone || (userId !== null && this.customerIds.includes(userId));
	}

	public equals(other: RewardAudience): boolean {
		return (
			this.type === other.type &&
			this.customerIds.length === other.customerIds.length &&
			this.customerIds.every((customerId, position) => other.customerIds.at(position) === customerId)
		);
	}
}
