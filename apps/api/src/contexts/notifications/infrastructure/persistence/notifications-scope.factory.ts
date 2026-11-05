import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { NotificationsScope } from "../../application/notifications-scope";
import type { NotificationsTransactionalPortsFactory } from "../adapters/transactional-email-requests.adapter";
import { PrismaEmailLogRepository } from "./prisma-email-log.repository";
import { PrismaNotificationAccountStore } from "./prisma-notification-account.store";
import { PrismaNotificationStore } from "./prisma-notification.store";
import { PrismaBroadcastStore } from "./prisma-broadcast.store";
import { PrismaBroadcastImageFiles } from "./prisma-broadcast-image-files";
import type { PublicUrlResolve } from "../../../../config/public-url.resolver";
import { createFilesTransactionalPorts } from "../../../files/public-api";

/** Builds notifications repositories bound to the unit-of-work transaction. Never cached. */
export class NotificationsScopeFactory implements ScopeFactory<NotificationsScope, Prisma.TransactionClient> {
	public constructor(
		private readonly ports: NotificationsTransactionalPortsFactory,
		/** The name a platform broadcast is sent as. */
		private readonly platformName: string,
		/** A stored file's public address (broadcast pictures, enhancement 5.4). */
		private readonly resolve: PublicUrlResolve,
	) {}

	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): NotificationsScope {
		const ports = this.ports.create(db, events);
		const broadcastImages = new PrismaBroadcastImageFiles(db, createFilesTransactionalPorts(db).fileReferences, this.resolve);
		return {
			emailLogs: new PrismaEmailLogRepository(db),
			emailRequests: ports.emailRequests,
			notify: ports.notifications,
			notificationStore: new PrismaNotificationStore(db, this.platformName, broadcastImages),
			accountStore: new PrismaNotificationAccountStore(db),
			broadcasts: new PrismaBroadcastStore(db),
			broadcastImages,
			events,
		};
	}
}
