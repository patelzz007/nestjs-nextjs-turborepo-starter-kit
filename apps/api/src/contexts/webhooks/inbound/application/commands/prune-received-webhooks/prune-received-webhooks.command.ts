import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../../platform/application/actor-context";

/**
 * Deletes received webhooks last received longer ago than the retention (`INBOUND_WEBHOOK_RETENTION_DAYS`).
 * They are a delivery log and the replay guard: a provider redelivers within hours (Svix's schedule ends
 * after about a day, GitHub lets a person redeliver for three days), so any retention of a week or more
 * keeps every redelivery recognised. One bounded DELETE on the `receivedAt` index, safe on every instance at once.
 */
export class PruneReceivedWebhooksCommand extends Command<number> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
