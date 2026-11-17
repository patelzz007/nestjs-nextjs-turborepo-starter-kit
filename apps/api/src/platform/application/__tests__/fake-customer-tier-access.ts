import { ENTRY_CUSTOMER_TIER, type CustomerTier } from "@workspace/shared";

import type { CustomerTierAccessPort } from "../ports/customer-tier-access.port";
import type { CustomerTierAccess } from "../../domain/customer-tier-access";

/**
 * {@link CustomerTierAccessPort} for unit tests (ADR 085): tiers off unless a test turns them on, then each customer at the
 * tier the test gives them (Bronze otherwise). Records who was asked about.
 */
export class FakeCustomerTierAccess implements CustomerTierAccessPort {
	public enabled = false;
	public readonly tiers = new Map<string, CustomerTier>();
	public readonly askedFor: (string | null)[] = [];

	/** Tiers on, with each customer's tier. */
	public static on(tiers: Readonly<Record<string, CustomerTier>> = {}): FakeCustomerTierAccess {
		const fake = new FakeCustomerTierAccess();
		fake.enabled = true;
		for (const [userId, tier] of Object.entries(tiers)) {
			fake.tiers.set(userId, tier);
		}
		return fake;
	}

	public accessFor(userId: string | null): Promise<CustomerTierAccess> {
		this.askedFor.push(userId);
		if (!this.enabled) {
			return Promise.resolve({ kind: "off" });
		}
		return Promise.resolve({ kind: "on", tier: userId === null ? ENTRY_CUSTOMER_TIER : (this.tiers.get(userId) ?? ENTRY_CUSTOMER_TIER) });
	}

	public tiersOf(userIds: readonly string[]): Promise<ReadonlyMap<string, CustomerTier> | null> {
		if (!this.enabled) {
			return Promise.resolve(null);
		}
		return Promise.resolve(new Map(userIds.map((userId): [string, CustomerTier] => [userId, this.tiers.get(userId) ?? ENTRY_CUSTOMER_TIER])));
	}
}
