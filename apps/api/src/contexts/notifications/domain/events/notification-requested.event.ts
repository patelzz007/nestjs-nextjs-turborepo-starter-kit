import type { EpochMs } from "@workspace/shared";

import { DomainEvent } from "../../../../platform/domain/domain-event";

/**
 * A notification was requested inside a business transaction (ADR 070): its row commits with the
 * business change. After commit it is handed to the fan-out at once; the maintenance sweep picks up any
 * row a crash left behind (the notification row is its own outbox).
 */
export class NotificationRequested extends DomainEvent {
	public readonly eventName = "notifications.NotificationRequested";

	public constructor(
		occurredAt: EpochMs,
		public readonly notificationId: string,
	) {
		super(occurredAt);
	}
}
