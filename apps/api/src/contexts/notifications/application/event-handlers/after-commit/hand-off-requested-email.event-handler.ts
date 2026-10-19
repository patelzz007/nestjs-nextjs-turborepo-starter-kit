import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { EmailRequested } from "../../../domain/events/email-requested.event";
import type { EmailRequestRelayPort } from "../../ports/email-request-relay.port";
import { EMAIL_REQUEST_RELAY } from "../../ports/notifications.tokens";

/**
 * Mechanism 2 (after commit, best effort): hands a just-committed email
 * request to the queue at once, so a password-reset email is not held until
 * the next outbox sweep. A failure is logged, never rethrown — the outbox row
 * is still PENDING and the sweep relays it (ADR 060).
 */
@EventsHandler(EmailRequested)
export class HandOffRequestedEmailOnEmailRequested implements IEventHandler<EmailRequested> {
	private readonly logger: Logger = new Logger(HandOffRequestedEmailOnEmailRequested.name);

	public constructor(@Inject(EMAIL_REQUEST_RELAY) private readonly relay: EmailRequestRelayPort) {}

	public async handle(event: EmailRequested): Promise<void> {
		try {
			await this.relay.relayNow(event.outboxEventId);
		} catch (error) {
			this.logger.warn(`Immediate hand-off of email ${event.emailLogId} failed; the outbox sweep will relay it: ${error instanceof Error ? error.message : "unknown error"}`);
		}
	}
}
