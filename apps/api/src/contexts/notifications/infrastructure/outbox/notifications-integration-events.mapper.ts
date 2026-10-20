import type { PlatformEventInput } from "@workspace/shared";

import type { IntegrationEventMapper } from "../../../../platform/application/events/integration-event-mapper";
import type { DomainEvent } from "../../../../platform/domain/domain-event";
import { EmailAttemptFinalized } from "../../domain/events/email-log-updated.event";

/**
 * Mechanism 3: an attempt outcome becomes the existing `email.log.updated`
 * outbox event in the same transaction (payload shape unchanged; no recipient
 * address on the wire). `EmailRequested` is NOT mapped here: its outbox row is
 * the internal `notification.email.requested` route, written by the request
 * itself, and it never reaches Kafka.
 */
export class NotificationsIntegrationEventsMapper implements IntegrationEventMapper {
	public map(event: DomainEvent): PlatformEventInput | null {
		if (event instanceof EmailAttemptFinalized) {
			return { type: "email.log.updated", payload: event.attempt };
		}
		return null;
	}
}
