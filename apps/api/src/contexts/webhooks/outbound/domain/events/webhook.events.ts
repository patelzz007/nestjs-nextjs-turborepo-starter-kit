import type { EpochMs } from "@workspace/shared";

import { DomainEvent } from "../../../../../platform/domain/domain-event";

/** A catalog event was written (in its producer's transaction); after commit it is fanned out at once. */
export class WebhookEventRecorded extends DomainEvent {
	public readonly eventName = "webhooks.WebhookEventRecorded";

	public constructor(
		occurredAt: EpochMs,
		public readonly eventId: string,
		public readonly tenantId: string,
	) {
		super(occurredAt);
	}
}

/** A delivery was queued by a member (a test or a redelivery); after commit it is handed to the sender. */
export class WebhookDeliveryQueued extends DomainEvent {
	public readonly eventName = "webhooks.WebhookDeliveryQueued";

	public constructor(
		occurredAt: EpochMs,
		public readonly deliveryId: string,
		public readonly tenantId: string,
	) {
		super(occurredAt);
	}
}

/** An endpoint turned itself off after too many deliveries in a row gave up. */
export class WebhookEndpointAutoDisabled extends DomainEvent {
	public readonly eventName = "webhooks.WebhookEndpointAutoDisabled";

	public constructor(
		occurredAt: EpochMs,
		public readonly endpointId: string,
		public readonly tenantId: string,
		public readonly url: string,
		public readonly consecutiveFailures: number,
	) {
		super(occurredAt);
	}
}

export type WebhookEndpointEvent = WebhookEndpointAutoDisabled;
