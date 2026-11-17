import { ENTRY_CUSTOMER_TIER, type CustomerTier } from "@workspace/shared";

import type { CustomerTierAccessPort } from "../../../../platform/application/ports/customer-tier-access.port";
import type { CustomerTierAccess } from "../../../../platform/domain/customer-tier-access";
import type { TierReadPort } from "../ports/tier-reads.port";
import type { TiersAvailabilityPort } from "../ports/tiers-availability.port";

/**
 * {@link CustomerTierAccessPort} (ADR 085): customers' tiers for the contexts that gate on them or show them. While
 * tiers are off, every reward is open and nobody shows a tier.
 */
export class TierAccessService implements CustomerTierAccessPort {
	public constructor(
		private readonly reads: Pick<TierReadPort, "storedTiersOf">,
		private readonly availability: TiersAvailabilityPort,
	) {}

	public async accessFor(userId: string | null): Promise<CustomerTierAccess> {
		if (!(await this.availability.isOn())) {
			return { kind: "off" };
		}
		if (userId === null) {
			return { kind: "on", tier: ENTRY_CUSTOMER_TIER };
		}
		const stored = await this.reads.storedTiersOf([userId]);
		return { kind: "on", tier: stored.get(userId) ?? ENTRY_CUSTOMER_TIER };
	}

	public async tiersOf(userIds: readonly string[]): Promise<ReadonlyMap<string, CustomerTier> | null> {
		if (!(await this.availability.isOn())) {
			return null;
		}
		const unique = [...new Set(userIds)];
		const stored = unique.length === 0 ? new Map<string, CustomerTier>() : await this.reads.storedTiersOf(unique);
		return new Map(unique.map((userId): [string, CustomerTier] => [userId, stored.get(userId) ?? ENTRY_CUSTOMER_TIER]));
	}
}
