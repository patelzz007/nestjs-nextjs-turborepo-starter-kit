import type { Prisma } from "@prisma/client";
import { epochMs } from "@workspace/shared";

import type { MerchantAccessGrant } from "../../../../platform/application/ports/authorization.port";
import type { RedemptionCustomer, RedemptionCustomerPort } from "../../../../platform/application/ports/redemption-customer.port";
import type { RedemptionCustomerFactory } from "../../../tenancy/public-api";
import { locationIdInFilter } from "../persistence/pos-list-queries";

/**
 * Tenants' `RedemptionCustomerPort`, on the ban's transaction: the customer behind one of the
 * tenant's live redemptions at a store of the caller's grant, with the reward and time staff know it by.
 */
export class PrismaRedemptionCustomer implements RedemptionCustomerPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async findRedemptionCustomer(grant: MerchantAccessGrant, redemptionId: string): Promise<RedemptionCustomer | null> {
		const locationFilter = locationIdInFilter(grant);
		const row = await this.db.rewardRedemption.findFirst({
			where: { id: redemptionId, tenantId: grant.tenantId, isDeleted: false, ...(locationFilter !== undefined ? { locationId: locationFilter } : {}) },
			select: { id: true, userId: true, redeemedAt: true, claim: { select: { reward: { select: { title: true } } } } },
		});
		return row === null ? null : { redemptionId: row.id, customerUserId: row.userId, rewardTitle: row.claim.reward.title, redeemedAt: epochMs(Number(row.redeemedAt)) };
	}
}

/** Binds {@link PrismaRedemptionCustomer} to the transaction tenants' unit of work hands it. */
export const PRISMA_REDEMPTION_CUSTOMER_FACTORY: RedemptionCustomerFactory = {
	forTransaction(db: Prisma.TransactionClient): RedemptionCustomerPort {
		return new PrismaRedemptionCustomer(db);
	},
};
