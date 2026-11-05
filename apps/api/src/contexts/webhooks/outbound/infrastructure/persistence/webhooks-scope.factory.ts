import type { Prisma } from "@prisma/client";

import type { ScopeFactory } from "../../../../../platform/application/events/in-transaction-event-handler";
import type { TransactionalEventCollector } from "../../../../../platform/application/events/transactional-event-collector";
import type { NotificationsTransactionalPortsFactory } from "../../../../notifications/public-api";
import { createRewardsTransactionalPorts } from "../../../../rewards/public-api";
import { createTenantsTransactionalPorts } from "../../../../tenancy/public-api";
import type { WebhooksScope } from "../../application/webhooks-scope";
import { PrismaWebhookDeliveryRepository, PrismaWebhookEndpointRepository, PrismaWebhookEventStore } from "./prisma-webhooks.repositories";

/**
 * Builds the webhooks scope on one transaction: webhooks' own rows, rewards' redemption facts (a claim's tenant),
 * tenancy's owners of a tenant and notifications' `notify()`, all bound to the same `db` (plan §5.4). The same
 * factory backs the producers' in-transaction handlers, so an event is appended in its producer's transaction.
 */
export class WebhooksScopeFactory implements ScopeFactory<WebhooksScope, Prisma.TransactionClient> {
	public constructor(private readonly notifications: NotificationsTransactionalPortsFactory) {}

	public create(db: Prisma.TransactionClient, events: TransactionalEventCollector): WebhooksScope {
		return {
			endpoints: new PrismaWebhookEndpointRepository(db),
			webhookEvents: new PrismaWebhookEventStore(db),
			deliveries: new PrismaWebhookDeliveryRepository(db),
			rewardFacts: createRewardsTransactionalPorts(db).redemptionFacts,
			tenantOwners: createTenantsTransactionalPorts(db).reviewNotices,
			notify: this.notifications.create(db, events).notifications,
			events,
		};
	}
}
