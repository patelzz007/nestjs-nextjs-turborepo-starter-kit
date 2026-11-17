import { ENTRY_CUSTOMER_TIER, type CustomerTier } from "@workspace/shared";

import type { CustomerTierAccessPort } from "../../../../platform/application/ports/customer-tier-access.port";
import { RewardMinimumTierUnavailableError } from "../../domain/errors/reward.errors";

/**
 * A reward can be given a minimum tier above Bronze only while tiers are on (ADR 085): with them off, every reward is open
 * to every customer, and a minimum tier set then would start locking customers out the moment tiers were turned on.
 */
export async function assertMinimumTierAvailable(tiers: Pick<CustomerTierAccessPort, "accessFor">, minimumTier: CustomerTier | undefined): Promise<void> {
	if (minimumTier === undefined || minimumTier === ENTRY_CUSTOMER_TIER) {
		return;
	}
	if ((await tiers.accessFor(null)).kind === "off") {
		throw new RewardMinimumTierUnavailableError();
	}
}
