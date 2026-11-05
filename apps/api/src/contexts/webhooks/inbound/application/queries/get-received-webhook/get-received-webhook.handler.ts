import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";
import type { ReceivedWebhookDetail } from "@workspace/shared";

import { NotFoundError } from "../../../../../../platform/application/errors/app-error";
import type { ReceivedWebhookReadPort } from "../../ports/received-webhook-read.port";
import { RECEIVED_WEBHOOK_READ } from "../../ports/webhooks-inbound.tokens";
import { GetReceivedWebhookQuery } from "./get-received-webhook.query";

/** `GET /admin/webhooks/received/:id`; an unknown id is a 404. */
@QueryHandler(GetReceivedWebhookQuery)
export class GetReceivedWebhookHandler implements IQueryHandler<GetReceivedWebhookQuery, ReceivedWebhookDetail> {
	public constructor(@Inject(RECEIVED_WEBHOOK_READ) private readonly reads: ReceivedWebhookReadPort) {}

	public async execute(query: GetReceivedWebhookQuery): Promise<ReceivedWebhookDetail> {
		const detail = await this.reads.findById(query.actor, query.input.id);
		if (detail === null) {
			throw new NotFoundError({ message: "The requested resource was not found.", details: { resourceId: query.input.id } });
		}
		return detail;
	}
}
