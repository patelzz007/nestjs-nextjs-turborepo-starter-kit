import { handlePlatformMessage, type KafkaRecord, type MessageHandlerDeps, type HandleOutcome } from "@workspace/messaging/inbox";

/** One message as the Kafka consumer's `eachMessage` hands it over. */
export interface PlatformEventDelivery {
	readonly topic: string;
	readonly partition: number;
	readonly message: { readonly offset: string; readonly value: Buffer | null };
}

/**
 * The reporting projection of the platform events (`reward.platform`, `session.action`, …):
 * each delivery is validated against the shared wire schema and written once to
 * `AnalyticsEvent` through the inbox (dedupe on `eventId`, bounded retry, dead letter).
 * At-least-once: the consumer commits the offset only after this resolves.
 */
export function projectPlatformEvent(delivery: PlatformEventDelivery, deps: MessageHandlerDeps): Promise<HandleOutcome> {
	const record: KafkaRecord = { topic: delivery.topic, partition: delivery.partition, offset: delivery.message.offset, value: delivery.message.value };
	return handlePlatformMessage(record, deps);
}
