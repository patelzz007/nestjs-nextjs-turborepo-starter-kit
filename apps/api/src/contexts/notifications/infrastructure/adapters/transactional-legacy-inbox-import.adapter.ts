import type { Prisma } from "@prisma/client";
import { newRowId } from "@workspace/shared";

import { DEFAULT_NOTIFICATION_LOCALE } from "../../domain/catalog/notification-type";
import { LEGACY_REWARD_NOTICE } from "../../domain/catalog/types/rewards.types";
import type { LegacyInboxImportPort, LegacyInboxNotice } from "../../application/ports/legacy-inbox-import.port";

/** The dedupe key of an imported legacy row: one notification per legacy id, however often the import runs. */
export function legacyDedupeKey(legacyId: string): string {
	return `legacy:${legacyId}`;
}

/**
 * Writes each legacy notice as an already-fanned-out notification (`fannedOutAt` set, so the fan-out
 * never delivers it) plus its inbox row, on ONE caller transaction (ADR 070).
 */
export class TransactionalLegacyInboxImport implements LegacyInboxImportPort {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async import(notices: readonly LegacyInboxNotice[], now: number): Promise<number> {
		const type = LEGACY_REWARD_NOTICE.declaration;
		let imported = 0;
		for (const notice of notices) {
			const notificationId = newRowId();
			const payload = { title: notice.title, body: notice.body, link: notice.link };
			const inserted = await this.db.notification.createMany({
				data: [
					{
						id: notificationId,
						createdAt: BigInt(notice.createdAt),
						recipientUserId: notice.userId,
						recipientKey: notice.userId,
						contactAddress: null,
						tenantId: null,
						typeKey: type.key,
						category: type.category,
						dedupeKey: legacyDedupeKey(notice.legacyId),
						payload,
						locale: DEFAULT_NOTIFICATION_LOCALE,
						fannedOutAt: BigInt(now),
					},
				],
				skipDuplicates: true,
			});
			if (inserted.count === 0) {
				continue;
			}
			await this.db.inAppNotification.create({
				data: {
					createdAt: BigInt(notice.createdAt),
					notificationId,
					userId: notice.userId,
					surface: notice.surface,
					typeKey: type.key,
					category: type.category,
					title: notice.title,
					body: notice.body,
					link: notice.link,
					icon: "gift",
					readAt: notice.readAt === null ? null : BigInt(notice.readAt),
				},
			});
			imported += 1;
		}
		return imported;
	}
}
