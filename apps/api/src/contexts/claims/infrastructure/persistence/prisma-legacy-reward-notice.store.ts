import type { Prisma, RewardNotification } from "@prisma/client";
import { z } from "zod";

import type { LegacyRewardNotice, LegacyRewardNoticeStore } from "../../application/ports/claims-transactional.ports";

/** The legacy `metadata` column held flat string pairs (`rewardId`, `href`, `signupReferralId`). */
const LegacyMetadataSchema = z.record(z.string(), z.string()).catch({});

function toLegacyRewardNotice(row: RewardNotification): LegacyRewardNotice {
	return {
		id: row.id,
		userId: row.userId,
		type: row.type,
		title: row.title,
		body: row.body,
		metadata: LegacyMetadataSchema.parse(row.metadata ?? {}),
		readAt: row.readAt === null ? null : Number(row.readAt),
		createdAt: Number(row.createdAt),
	};
}

/** `RewardNotification` on one unit-of-work transaction, for its one-time move (ADR 070). */
export class PrismaLegacyRewardNoticeStore implements LegacyRewardNoticeStore {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async takeBatch(limit: number): Promise<readonly LegacyRewardNotice[]> {
		const rows = await this.db.rewardNotification.findMany({ where: { isDeleted: false }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: limit });
		return rows.map(toLegacyRewardNotice);
	}

	public async retire(ids: readonly string[], now: number, by: string): Promise<void> {
		if (ids.length === 0) {
			return;
		}
		await this.db.rewardNotification.updateMany({
			where: { id: { in: [...ids] }, isDeleted: false },
			data: { isDeleted: true, deletedAt: BigInt(now), deletedBy: by, updatedAt: BigInt(now), updatedBy: by },
		});
	}
}
