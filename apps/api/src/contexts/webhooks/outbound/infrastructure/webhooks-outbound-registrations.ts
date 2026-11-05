import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { bindInTransactionHandler } from "../../../../platform/application/events/in-transaction-event-handler";
import { InTransactionEventRegistry } from "../../../../platform/application/events/in-transaction-event-registry";
import { NotificationsTransactionalPortsFactory } from "../../../notifications/public-api";
import {
	RecordWebhookOnClaim,
	RecordWebhookOnPaymentStatusChanged,
	RecordWebhookOnRewardReview,
	RecordWebhookOnSaleCheckedOut,
} from "../application/event-handlers/in-transaction/record-webhook-events.in-transaction-handlers";
import type { WebhookIdGenerator } from "../application/ports/webhook-ids.port";
import { WEBHOOK_IDS } from "../application/ports/webhooks-outbound.tokens";
import { WebhooksScopeFactory } from "./persistence/webhooks-scope.factory";

/**
 * The outgoing webhook catalog's producers (mechanism 1): rewards', claims', pos' and payments' events become
 * catalog events in the transaction that produced them (ADR 082).
 */
@Injectable()
export class WebhooksOutboundRegistrations implements OnModuleInit {
	public constructor(
		@Inject(InTransactionEventRegistry) private readonly handlers: InTransactionEventRegistry<Prisma.TransactionClient>,
		private readonly notifications: NotificationsTransactionalPortsFactory,
		@Inject(WEBHOOK_IDS) private readonly ids: WebhookIdGenerator,
	) {}

	public onModuleInit(): void {
		const scopes = new WebhooksScopeFactory(this.notifications);
		this.handlers.register(bindInTransactionHandler(new RecordWebhookOnRewardReview(this.ids), scopes));
		this.handlers.register(bindInTransactionHandler(new RecordWebhookOnClaim(this.ids), scopes));
		this.handlers.register(bindInTransactionHandler(new RecordWebhookOnSaleCheckedOut(this.ids), scopes));
		this.handlers.register(bindInTransactionHandler(new RecordWebhookOnPaymentStatusChanged(this.ids), scopes));
	}
}
