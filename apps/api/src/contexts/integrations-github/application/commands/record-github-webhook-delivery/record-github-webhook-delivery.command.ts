import { Command } from "@nestjs/cqrs";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { InboundWebhookRequest } from "../../../../webhooks/inbound/public-api";

/** What a delivery came to: `recorded`, `duplicate` (a redelivery), `ping` (GitHub testing the hook) or `ignored` (an event this server does not use). */
export type GithubWebhookOutcome = "recorded" | "duplicate" | "ping" | "ignored";

/** The delivery exactly as received: its headers and the raw body its signature covers. */
export interface RecordGithubWebhookDeliveryInput {
	readonly request: InboundWebhookRequest;
}

/**
 * One delivery from GitHub, through the shared inbound path (ADR 081): verified against the secret before
 * anything in it is read, claimed once by its delivery id in the received-webhook log (a redelivery answers
 * `duplicate` without being processed), recorded once in GitHub's own table (ON CONFLICT DO NOTHING) and
 * announced to every API instance only by the request that recorded it.
 */
export class RecordGithubWebhookDeliveryCommand extends Command<GithubWebhookOutcome> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: RecordGithubWebhookDeliveryInput,
	) {
		super();
	}
}
