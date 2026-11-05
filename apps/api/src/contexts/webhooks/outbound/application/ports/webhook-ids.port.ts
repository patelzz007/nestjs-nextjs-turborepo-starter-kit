/** Ids of new endpoints, events and deliveries (UUIDv7, so the delivery log sorts by time). */
export interface WebhookIdGenerator {
	next(): string;
}
