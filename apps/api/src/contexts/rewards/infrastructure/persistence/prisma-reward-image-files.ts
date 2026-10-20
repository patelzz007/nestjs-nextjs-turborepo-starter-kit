import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { RewardImageFileScope, RewardImageFileUses } from "../../application/ports/reward-image-files.port";

class PrismaRewardImageFileUses implements RewardImageFileUses {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public countLiveUses(fileId: string): Promise<number> {
		return this.db.rewardImage.count({ where: { fileId, isDeleted: false, reward: { isDeleted: false } } });
	}
}

/** Binds rewards' image rows to the files transaction that asks whether a file may be deleted. Never cached. */
export class RewardImageFileScopeFactory implements ScopeFactory<RewardImageFileScope, Prisma.TransactionClient> {
	public create(db: Prisma.TransactionClient): RewardImageFileScope {
		return { rewardImages: new PrismaRewardImageFileUses(db) };
	}
}
