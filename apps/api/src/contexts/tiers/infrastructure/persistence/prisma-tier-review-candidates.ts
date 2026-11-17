import type { EpochMs } from "@workspace/shared";

import type { TierReviewCandidatesPort } from "../../application/ports/tier-review-candidates.port";
import { TIER_STANDING_READ_OPERATION } from "../../application/ports/tiers.tokens";
import type { TierReadTransactions } from "./prisma-tier.read-repository";

/** Plain code-unit order, the order the ids' cursor pages in (ids are lower-case hex UUIDs, the same in every collation). */
function byCodeUnits(left: string, right: string): number {
	if (left === right) {
		return 0;
	}
	return left < right ? -1 : 1;
}

/**
 * {@link TierReviewCandidatesPort} over Prisma: the next page of each source after the cursor, merged in id order. A
 * user beyond the page in either source comes back on a later page (its id is after the new cursor), and one in both
 * sources is reviewed once per page.
 */
export class PrismaTierReviewCandidates implements TierReviewCandidatesPort {
	public constructor(private readonly transactions: TierReadTransactions) {}

	public page(afterUserId: string | null, limit: number, recentSince: EpochMs): Promise<readonly string[]> {
		return this.transactions.withSystemOperation(
			{ operation: TIER_STANDING_READ_OPERATION, reason: "Tiers: the nightly review's customers", actorUserId: null },
			async (db) => {
				const after = afterUserId === null ? {} : { gt: afterUserId };
				const [aboveBronze, recent] = await Promise.all([
					db.customerTierStanding.findMany({
						where: { isDeleted: false, tier: { not: "BRONZE" }, userId: after },
						orderBy: { userId: "asc" },
						take: limit,
						select: { userId: true },
					}),
					db.rewardRedemption.findMany({
						where: { isDeleted: false, redeemedAt: { gt: BigInt(recentSince) }, userId: after },
						orderBy: { userId: "asc" },
						distinct: ["userId"],
						take: limit,
						select: { userId: true },
					}),
				]);
				const merged = [...new Set([...aboveBronze, ...recent].map((row) => row.userId))].sort(byCodeUnits);
				return merged.slice(0, limit);
			},
		);
	}
}
