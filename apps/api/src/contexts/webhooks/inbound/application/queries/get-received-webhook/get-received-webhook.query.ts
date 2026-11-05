import { Query } from "@nestjs/cqrs";
import type { ReceivedWebhookDetail, ReceivedWebhookIdParam } from "@workspace/shared";

import type { ActorContext } from "../../../../../../platform/application/actor-context";

/** One complete received webhook (`GET /admin/webhooks/received/:id`). */
export class GetReceivedWebhookQuery extends Query<ReceivedWebhookDetail> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: ReceivedWebhookIdParam,
	) {
		super();
	}
}
