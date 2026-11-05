import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { WebhookEndpointSummary } from "@workspace/shared";

import type { MerchantAccessPort } from "../../../../../../platform/application/ports/authorization.port";
import { MERCHANT_ACCESS } from "../../../../../tenancy/public-api";
import { WebhookEndpointNotFoundError } from "../../../domain/errors/webhooks.errors";
import type { WebhooksReadPort } from "../../ports/webhooks-read.port";
import { WEBHOOK_READS } from "../../ports/webhooks-outbound.tokens";
import { assertWebhookMember } from "../../services/webhook-member";
import { GetWebhookEndpointQuery } from "./get-webhook-endpoint.query";

@QueryHandler(GetWebhookEndpointQuery)
export class GetWebhookEndpointHandler implements IQueryHandler<GetWebhookEndpointQuery, WebhookEndpointSummary> {
	public constructor(
		@Inject(MERCHANT_ACCESS) private readonly merchantAccess: MerchantAccessPort,
		@Inject(WEBHOOK_READS) private readonly reads: WebhooksReadPort,
	) {}

	public async execute(query: GetWebhookEndpointQuery): Promise<WebhookEndpointSummary> {
		const member = await assertWebhookMember(this.merchantAccess, query.actor, query.tenantId);
		const endpoint = await this.reads.findEndpoint(member.actor, query.tenantId, query.endpointId);
		if (endpoint === null) {
			throw new WebhookEndpointNotFoundError(query.endpointId);
		}
		return endpoint;
	}
}
