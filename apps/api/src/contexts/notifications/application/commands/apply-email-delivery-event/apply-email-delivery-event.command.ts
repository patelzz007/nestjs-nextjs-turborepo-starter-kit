import { Command } from "@nestjs/cqrs";
import type { EmailLogStatus } from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { DeliveryEventRecordResult } from "../../../domain/repositories/email-log.repository";

/** A verified delivery-webhook event, as the controller hands it over. */
export interface DeliveryWebhookEvent {
	readonly webhookId: string;
	readonly eventType: string;
	readonly resendId: string;
	readonly taggedEmailLogId: string | undefined;
	/** The status the event maps to; `undefined` for events the log ignores (tracking). */
	readonly status: EmailLogStatus | undefined;
	readonly detail: string | undefined;
	readonly occurredAt: number;
}

/** Record one verified Resend webhook event (once per webhook id) and move its row forward when allowed. */
export class ApplyEmailDeliveryEventCommand extends Command<DeliveryEventRecordResult> {
	public constructor(
		public readonly actor: ActorContext,
		public readonly input: DeliveryWebhookEvent,
	) {
		super();
	}
}
