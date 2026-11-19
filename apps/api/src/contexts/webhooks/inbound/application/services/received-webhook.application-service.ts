import { Inject, Injectable } from "@nestjs/common";
import type { PaginatedServiceResult, ReceivedWebhookDetail, ReceivedWebhookIdParam, ReceivedWebhookListQuery, ReceivedWebhookSummary } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import { NotFoundError } from "../../../../../platform/application/errors/app-error";
import type { ReceivedWebhookReadPort } from "../ports/received-webhook-read.port";
import { RECEIVED_WEBHOOK_READ } from "../ports/webhooks-inbound.tokens";

/** The admin reads of received webhooks (ADR 096). An unknown id is a 404. */
@Injectable()
export class ReceivedWebhookApplicationService {
	public constructor(@Inject(RECEIVED_WEBHOOK_READ) private readonly reads: ReceivedWebhookReadPort) {}

	/** `GET /admin/webhooks/received`. */
	public list(actor: ActorContext, input: ReceivedWebhookListQuery): Promise<PaginatedServiceResult<ReceivedWebhookSummary>> {
		return this.reads.list(actor, input);
	}

	/** `GET /admin/webhooks/received/:id`. */
	public async get(actor: ActorContext, input: ReceivedWebhookIdParam): Promise<ReceivedWebhookDetail> {
		const detail = await this.reads.findById(actor, input.id);
		if (detail === null) {
			throw new NotFoundError({ message: "The requested resource was not found.", details: { resourceId: input.id } });
		}
		return detail;
	}
}
