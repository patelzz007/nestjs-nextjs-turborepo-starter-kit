import { Query } from "@nestjs/cqrs";
import type { PaginatedServiceResult, ReceivedWebhookListQuery, ReceivedWebhookSummary } from "@workspace/shared";

import type { ActorContext } from "../../../../../../platform/application/actor-context";

/** One page of the received-webhook log (newest first by default; shared list grammar). */
export class ListReceivedWebhooksQuery extends Query<PaginatedServiceResult<ReceivedWebhookSummary>> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ReceivedWebhookListQuery,
	) {
		super();
	}
}
