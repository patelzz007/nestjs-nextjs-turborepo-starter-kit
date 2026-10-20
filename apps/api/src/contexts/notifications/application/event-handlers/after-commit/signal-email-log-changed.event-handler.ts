import { Inject } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { EmailAttemptFinalized, EmailDeliveryStatusChanged } from "../../../domain/events/email-log-updated.event";
import type { EmailLogSignalPort } from "../../ports/email-log-signal.port";
import { EMAIL_LOG_SIGNAL } from "../../ports/notifications.tokens";

/**
 * Mechanism 2: one "email log changed" signal per committed write, for the
 * admin SSE stream. Never fires for a rolled-back write. An attempt outcome
 * carries its payload; a webhook status flip carries none.
 */
@EventsHandler(EmailAttemptFinalized, EmailDeliveryStatusChanged)
export class SignalEmailLogChanged implements IEventHandler<EmailAttemptFinalized | EmailDeliveryStatusChanged> {
	public constructor(@Inject(EMAIL_LOG_SIGNAL) private readonly signal: EmailLogSignalPort) {}

	public handle(event: EmailAttemptFinalized | EmailDeliveryStatusChanged): void {
		if (event instanceof EmailAttemptFinalized) {
			this.signal.emitUpdated(event.attempt);
			return;
		}
		this.signal.emitUpdated();
	}
}
