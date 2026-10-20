import type { EmailLogUpdatedEvent, EpochMs } from "@workspace/shared";

import { DomainEvent } from "../../../../platform/domain/domain-event";

/**
 * An email log row reached an outcome (a send succeeded or failed, or a
 * simulated mode wrote it final). Mapped to the existing `email.log.updated`
 * outbox event in the same transaction, and signals the admin SSE stream after commit.
 */
export class EmailAttemptFinalized extends DomainEvent {
	public readonly eventName = "notifications.EmailAttemptFinalized";

	public constructor(
		occurredAt: EpochMs,
		public readonly emailLogId: string,
		/** The integration payload. The recipient address is deliberately NOT part of it (PII on the Kafka wire). */
		public readonly attempt: EmailLogUpdatedEvent,
	) {
		super(occurredAt);
	}
}

/** A verified delivery webhook moved a row forward. In-process only: it signals the admin SSE stream after commit. */
export class EmailDeliveryStatusChanged extends DomainEvent {
	public readonly eventName = "notifications.EmailDeliveryStatusChanged";

	public constructor(
		occurredAt: EpochMs,
		public readonly emailLogId: string,
	) {
		super(occurredAt);
	}
}
