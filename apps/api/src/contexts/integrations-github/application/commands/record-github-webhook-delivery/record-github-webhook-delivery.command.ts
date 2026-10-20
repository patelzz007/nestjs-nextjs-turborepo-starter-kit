import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { GithubWebhookHeaders } from "../../../domain/policies/webhook-delivery.policy";

/** What a delivery came to: `recorded`, `duplicate` (a redelivery), `ping` (GitHub testing the hook) or `ignored` (an event this server does not use). */
export type GithubWebhookOutcome = "recorded" | "duplicate" | "ping" | "ignored";

/** The delivery exactly as received: its headers and the raw body its signature covers. */
export interface RecordGithubWebhookDeliveryInput {
	readonly headers: GithubWebhookHeaders;
	readonly rawBody: Buffer;
}

/** One delivery from GitHub: verified against the secret before anything in it is read, recorded once by its delivery id (ON CONFLICT DO NOTHING — GitHub redelivers), and announced to every API instance only by the request that recorded it. */
export class RecordGithubWebhookDeliveryCommand extends Command<GithubWebhookOutcome> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RecordGithubWebhookDeliveryInput,
	) {
		super();
	}
}
