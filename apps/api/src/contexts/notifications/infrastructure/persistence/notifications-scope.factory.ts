import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { NotificationsScope } from "../../application/notifications-scope";
import type { NotificationsTransactionalPortsFactory } from "../adapters/transactional-email-requests.adapter";
import { PrismaEmailLogRepository } from "./prisma-email-log.repository";
import { PrismaNotificationAccountStore } from "./prisma-notification-account.store";
import { PrismaNotificationStore } from "./prisma-notification.store";
import { PrismaBroadcastStore } from "./prisma-broadcast.store";

/** Builds notifications repositories bound to the unit-of-work transaction. Never cached. */
export class NotificationsScopeFactory implements ScopeFactory<NotificationsScope, Prisma.TransactionClient> {
	public constructor(
		private readonly ports: NotificationsTransactionalPortsFactory,
		/** The name a platform broadcast is sent as. */
		private readonly platformName: string,
	) {}

	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): NotificationsScope {
		const ports = this.ports.create(db, events);
		return {
			emailLogs: new PrismaEmailLogRepository(db),
			emailRequests: ports.emailRequests,
			notify: ports.notifications,
			notificationStore: new PrismaNotificationStore(db, this.platformName),
			accountStore: new PrismaNotificationAccountStore(db),
			broadcasts: new PrismaBroadcastStore(db),
			events,
		};
	}
}
