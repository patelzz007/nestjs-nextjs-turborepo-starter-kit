import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";

/**
 * How long a delivery is kept: GitHub redelivers automatically within minutes and lets a person
 * redeliver by hand for 3 days, so a week covers every redelivery with room to spare.
 */
export const GITHUB_WEBHOOK_DELIVERY_RETENTION_MS = 604_800_000;

/** Deletes recorded webhook deliveries past their retention; they exist only to recognise redeliveries. One bounded DELETE on the `receivedAt` index, safe on every instance at once. */
export class PruneGithubWebhookDeliveriesCommand extends Command<number> {
	public constructor(public readonly actor: ActorContext) {
		super();
	}
}
