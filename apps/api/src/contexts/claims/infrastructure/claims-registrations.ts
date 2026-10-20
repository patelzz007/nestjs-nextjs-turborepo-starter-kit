import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { bindInTransactionHandler } from "../../../platform/application/events/in-transaction-event-handler";
import { InTransactionEventRegistry } from "../../../platform/application/events/in-transaction-event-registry";
import { IntegrationEventMapperRegistry } from "../../../platform/application/events/integration-event-mapper";
import { NotificationsTransactionalPortsFactory } from "../../notifications/public-api";
import { TENANT_READ, type TenantReadPort } from "../../tenancy/public-api";
import { IssueReferrerCreditClaimOnReferrerCredited } from "../application/event-handlers/in-transaction/issue-referrer-credit-claim.in-transaction-handler";
import {
	RecordNotificationOnReferrerCredited,
	RecordOwnerNoticesOnRewardReview,
} from "../application/event-handlers/in-transaction/record-reward-notices.in-transaction-handlers";
import type { ClaimCodesPort } from "../application/ports/claim-codes.port";
import { CLAIM_CODES, CLAIM_ID_GENERATOR, type ClaimIdGenerator } from "../application/ports/claims.tokens";
import { ClaimsIntegrationEventsMapper } from "./outbox/claims-integration-events.mapper";
import { ClaimsScopeFactory } from "./persistence/claims-scope.factory";

/**
 * Claims' mechanism-1 reactions to other contexts' events, written in the producing transaction (the
 * owner notices of a review decision; a credited referrer's credit claim and inbox notice), and its
 * mechanism-3 outbox mapper.
 */
@Injectable()
export class ClaimsRegistrations implements OnModuleInit {
	public constructor(
		@Inject(InTransactionEventRegistry) private readonly handlers: InTransactionEventRegistry<Prisma.TransactionClient>,
		private readonly notifications: NotificationsTransactionalPortsFactory,
		@Inject(TENANT_READ) private readonly tenants: TenantReadPort,
		private readonly mappers: IntegrationEventMapperRegistry,
		@Inject(CLAIM_CODES) private readonly codes: ClaimCodesPort,
		@Inject(CLAIM_ID_GENERATOR) private readonly ids: ClaimIdGenerator,
	) {}

	public onModuleInit(): void {
		const scopes = new ClaimsScopeFactory(this.notifications);
		this.handlers.register(bindInTransactionHandler(new RecordOwnerNoticesOnRewardReview(this.tenants), scopes));
		this.handlers.register(bindInTransactionHandler(new RecordNotificationOnReferrerCredited(), scopes));
		this.handlers.register(bindInTransactionHandler(new IssueReferrerCreditClaimOnReferrerCredited(this.codes, this.ids), scopes));
		this.mappers.register(new ClaimsIntegrationEventsMapper());
	}
}
