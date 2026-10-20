import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { ConcurrentModificationError } from "../../../../platform/infrastructure/persistence/persistence.errors";
import { RewardReferral } from "../../domain/aggregates/reward-referral.aggregate";
import type { RewardReferralRepository } from "../../domain/repositories/referral.repositories";

/** The locked PENDING referral row (raw SQL: Prisma has no `FOR UPDATE`). */
const LockedReferralRowSchema = z.object({ id: z.string(), referrerUserId: z.string() });

/** Reward referrals on one unit-of-work transaction. */
export class PrismaRewardReferralRepository implements RewardReferralRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async lockPendingFor(rewardId: string, refereeUserId: string): Promise<RewardReferral | null> {
		const rows = await this.db.$queryRaw`
			SELECT id, "referrerUserId" FROM "RewardReferral"
			WHERE "rewardId" = ${rewardId} AND "refereeUserId" = ${refereeUserId} AND status = 'PENDING' AND "isDeleted" = false
			ORDER BY id
			LIMIT 1
			FOR UPDATE`;
		const [row] = LockedReferralRowSchema.array().parse(rows);
		return row === undefined ? null : RewardReferral.pending({ id: row.id, rewardId, referrerUserId: row.referrerUserId, refereeUserId });
	}

	public async save(referral: RewardReferral): Promise<void> {
		const creditedAt = referral.creditedAtTime;
		if (creditedAt === null) {
			return;
		}
		const updated = await this.db.rewardReferral.updateMany({
			where: { id: referral.id, status: "PENDING", isDeleted: false },
			data: { status: "CREDITED", creditedAt, updatedAt: creditedAt },
		});
		if (updated.count !== 1) {
			throw new ConcurrentModificationError(referral.id);
		}
	}
}
