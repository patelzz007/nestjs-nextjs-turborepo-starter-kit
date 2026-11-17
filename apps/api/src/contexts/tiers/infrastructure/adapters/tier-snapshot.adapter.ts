import type { Prisma } from "@prisma/client";
import { CustomerTierSchema, ENTRY_CUSTOMER_TIER, type CustomerTier } from "@workspace/shared";

import type { CustomerTierSnapshotPort } from "../../../../platform/application/ports/customer-tier-snapshot.port";
import type { CustomerTierSnapshotFactory } from "../../../pos/public-api";

/**
 * The customer's stored tier inside the till's checkout transaction, under the API key's own session (the key reads the
 * standing of its tenant's customers, 67-customer-tiers.sql). Only a read: tier rules never run inside a checkout.
 */
export class PrismaTierSnapshot implements CustomerTierSnapshotPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async tierOf(customerUserId: string): Promise<CustomerTier> {
		const row = await this.db.customerTierStanding.findFirst({ where: { userId: customerUserId, isDeleted: false }, select: { tier: true } });
		return row === null ? ENTRY_CUSTOMER_TIER : CustomerTierSchema.parse(row.tier);
	}
}

/** Binds {@link PrismaTierSnapshot} to the transaction pos's checkout hands it. */
export const PRISMA_TIER_SNAPSHOT_FACTORY: CustomerTierSnapshotFactory = {
	forTransaction(db: Prisma.TransactionClient): CustomerTierSnapshotPort {
		return new PrismaTierSnapshot(db);
	},
};
