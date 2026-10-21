import type { Prisma } from "@prisma/client";
import type { EpochMs } from "@workspace/shared";

import type { RefereeAttributionFactory, RefereeAttributionPort } from "../../../referrals/public-api";

/**
 * The user's pending reward-referral attribution (identity owns `User`): the latest link they opened.
 * The claim handler reads it through `ConsumerClaimantPort` and clears it once the claim used it.
 */
export class PrismaRefereeAttribution implements RefereeAttributionPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async setPending(userId: string, attributionToken: string, expiresAt: EpochMs, now: EpochMs): Promise<boolean> {
		const updated = await this.db.user.updateMany({
			where: { id: userId, isDeleted: false },
			data: { pendingAttributionToken: attributionToken, pendingAttributionExpiresAt: expiresAt, updatedAt: now, updatedBy: userId },
		});
		return updated.count === 1;
	}
}

/** What identity provides under referrals' `REFEREE_ATTRIBUTION_FACTORY`. */
export const IDENTITY_REFEREE_ATTRIBUTION_FACTORY: RefereeAttributionFactory = {
	forTransaction(db: Prisma.TransactionClient): RefereeAttributionPort {
		return new PrismaRefereeAttribution(db);
	},
};
