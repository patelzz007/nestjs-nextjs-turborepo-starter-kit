import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../platform/application/events/transactional-event-collector";
import type { NotificationsScope } from "../../application/notifications-scope";
import type { NotificationsTransactionalPortsFactory } from "../adapters/transactional-email-requests.adapter";
import { PrismaEmailLogRepository } from "./prisma-email-log.repository";

/** Builds notifications repositories bound to the unit-of-work transaction. Never cached. */
export class NotificationsScopeFactory implements ScopeFactory<NotificationsScope, Prisma.TransactionClient> {
	public constructor(private readonly ports: NotificationsTransactionalPortsFactory) {}

	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): NotificationsScope {
		return {
			emailLogs: new PrismaEmailLogRepository(db),
			emailRequests: this.ports.create(db, events).emailRequests,
			events,
		};
	}
}
