import type { Prisma } from "@prisma/client";
import type { EpochMs } from "@workspace/shared";

import type { RewardNotice, RewardNotificationInbox } from "../../application/ports/claims-transactional.ports";

/** The reward notification inbox (`RewardNotification`) on one unit-of-work transaction. */
export class PrismaRewardNotificationInbox implements RewardNotificationInbox {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async add(notices: readonly RewardNotice[]): Promise<void> {
		if (notices.length === 0) {
			return;
		}
		await this.db.rewardNotification.createMany({
			data: notices.map((notice: RewardNotice) => ({ userId: notice.userId, type: notice.type, title: notice.title, body: notice.body, metadata: { ...notice.metadata } })),
		});
	}

	public async markRead(userId: string, selection: { readonly notificationIds: readonly string[] } | "all", now: EpochMs): Promise<void> {
		await this.db.rewardNotification.updateMany({
			where: { userId, readAt: null, isDeleted: false, ...(selection === "all" ? {} : { id: { in: [...selection.notificationIds] } }) },
			data: { readAt: now, updatedAt: now },
		});
	}
}
