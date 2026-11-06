import type { Prisma } from "@prisma/client";

import type { Clock } from "../../../../platform/application/clock.port";
import { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import type { NotificationAttachment } from "@workspace/shared";

import {
	NOTIFICATIONS_DEMO_OPERATION,
	SHOWCASE_PHOTO_COUNT,
	SHOWCASE_PHOTO_MIN_WIDTH,
	type DemoNotificationsStore,
	type DemoRecipientLookup,
	type DemoRecipientQuery,
} from "../../application/services/demo-notifications";
import type { NotifyTransactionalPort } from "../../application/ports/notify.port";
import { TransactionalNotify } from "../adapters/transactional-notify.adapter";
import { NOTIFICATION_ATTACHMENT_FILE_SELECT, notificationAttachmentOf } from "./notification-attachment.mapper";

/** Enough rows to tell "the only superadmin" from "several". */
const SUPERADMIN_PROBE_LIMIT = 2;

const DEMO_CONTEXT: SystemDatabaseContext = {
	operation: NOTIFICATIONS_DEMO_OPERATION,
	reason: "Development tool: request the demo notifications for one person",
	actorUserId: null,
};

/**
 * The demo's reads and writes, each on one transaction under `notifications.demo` (User, Notification and the
 * stored files it attaches). Notifications are written by the API's own `notify()` adapter; its after-commit event is not
 * published here — the caller hands the rows to the fan-out queue itself.
 */
export class PrismaDemoNotificationsStore implements DemoNotificationsStore {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly clock: Clock,
	) {}

	public findRecipient(query: DemoRecipientQuery): Promise<DemoRecipientLookup> {
		return this.tenantTx.withSystemOperation(DEMO_CONTEXT, async (tx): Promise<DemoRecipientLookup> => {
			if (query.kind === "email") {
				const user = await tx.user.findFirst({ where: { email: { equals: query.email, mode: "insensitive" }, isDeleted: false }, select: { id: true, email: true } });
				return user === null ? { kind: "not-found" } : { kind: "found", userId: user.id, email: user.email };
			}
			const superadmins = await tx.user.findMany({
				where: { isSuperAdmin: true, isDeleted: false },
				select: { id: true, email: true },
				orderBy: { createdAt: "asc" },
				take: SUPERADMIN_PROBE_LIMIT,
			});
			const [only, other] = superadmins;
			if (only === undefined) {
				return { kind: "ambiguous", superadmins: "none" };
			}
			if (other !== undefined) {
				return { kind: "ambiguous", superadmins: "several" };
			}
			return { kind: "found", userId: only.id, email: only.email };
		});
	}

	public findShowcaseAttachments(): Promise<readonly NotificationAttachment[]> {
		return this.tenantTx.withSystemOperation(DEMO_CONTEXT, async (tx): Promise<readonly NotificationAttachment[]> => {
			const live = { status: "READY", isDeleted: false } satisfies Prisma.StoredFileWhereInput;
			const photos = await tx.storedFile.findMany({
				where: { ...live, category: "REWARD_IMAGE", imageWidth: { gte: SHOWCASE_PHOTO_MIN_WIDTH } },
				orderBy: { id: "asc" },
				take: SHOWCASE_PHOTO_COUNT,
				select: NOTIFICATION_ATTACHMENT_FILE_SELECT,
			});
			const documents = await tx.storedFile.findMany({
				where: { ...live, category: "NOTIFICATION_DOCUMENT" },
				orderBy: { id: "asc" },
				take: 1,
				select: NOTIFICATION_ATTACHMENT_FILE_SELECT,
			});
			return [...photos, ...documents].flatMap((file): NotificationAttachment[] => {
				const attachment = notificationAttachmentOf(file);
				return attachment === null ? [] : [attachment];
			});
		});
	}

	public inTransaction<T>(work: (notify: NotifyTransactionalPort) => Promise<T>): Promise<T> {
		return this.tenantTx.withSystemOperation(DEMO_CONTEXT, (tx): Promise<T> => work(new TransactionalNotify(tx, new TransactionalEventCollector(), this.clock)));
	}
}
