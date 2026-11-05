import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { PaginatedServiceResult, ReceivedWebhookSummary } from "@workspace/shared";

import type { ReceivedWebhookReadPort } from "../../ports/received-webhook-read.port";
import { RECEIVED_WEBHOOK_READ } from "../../ports/webhooks-inbound.tokens";
import { ListReceivedWebhooksQuery } from "./list-received-webhooks.query";

/** `GET /admin/webhooks/received`. */
@QueryHandler(ListReceivedWebhooksQuery)
export class ListReceivedWebhooksHandler implements IQueryHandler<ListReceivedWebhooksQuery, PaginatedServiceResult<ReceivedWebhookSummary>> {
	public constructor(@Inject(RECEIVED_WEBHOOK_READ) private readonly reads: ReceivedWebhookReadPort) {}

	public execute(query: ListReceivedWebhooksQuery): Promise<PaginatedServiceResult<ReceivedWebhookSummary>> {
		return this.reads.list(query.actor, query.input);
	}
}
