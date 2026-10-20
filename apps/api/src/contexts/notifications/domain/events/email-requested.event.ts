import type { EpochMs } from "@workspace/shared";

import { DomainEvent } from "../../../../platform/domain/domain-event";

/**
 * An email was requested inside a business transaction (ADR 060): its
 * `pending` log row and its `notification.email.requested` outbox row commit
 * with the business row. After commit, the notifications context hands the
 * outbox row to the email queue at once; the outbox sweep is the backstop.
 */
export class EmailRequested extends DomainEvent {
	public readonly eventName = "notifications.EmailRequested";

	public constructor(
		occurredAt: EpochMs,
		public readonly emailLogId: string,
		public readonly outboxEventId: string,
	) {
		super(occurredAt);
	}
}
