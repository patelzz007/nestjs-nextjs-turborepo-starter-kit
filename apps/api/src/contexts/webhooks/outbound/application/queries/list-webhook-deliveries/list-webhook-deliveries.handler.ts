import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { PaginatedServiceResult, WebhookDeliverySummary } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../../platform/application/ports/authorization.port";
import { MERCHANT_ACCESS } from "../../../../../tenancy/public-api";
import type { WebhooksReadPort } from "../../ports/webhooks-read.port";
import { WEBHOOK_READS } from "../../ports/webhooks-outbound.tokens";
import { assertWebhookMember } from "../../services/webhook-member";
import { ListWebhookDeliveriesQuery } from "./list-webhook-deliveries.query";

@QueryHandler(ListWebhookDeliveriesQuery)
export class ListWebhookDeliveriesHandler implements IQueryHandler<ListWebhookDeliveriesQuery, PaginatedServiceResult<WebhookDeliverySummary>> {
	public constructor(
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(WEBHOOK_READS) private readonly reads: WebhooksReadPort,
	) {}

	public async execute(query: ListWebhookDeliveriesQuery): Promise<PaginatedServiceResult<WebhookDeliverySummary>> {
		const member = await assertWebhookMember(this.merchantAccess, query.actor, query.tenantId);
		return this.reads.listDeliveries(member.actor, query.tenantId, query.query);
	}
}
