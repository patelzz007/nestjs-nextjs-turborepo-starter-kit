import { z } from "zod";

/** Why a message was parked — mirrors the `InboxDeadLetterReason` Postgres enum (schema.prisma). */
export const DeadLetterReasonSchema = z.enum(["EMPTY_MESSAGE", "MALFORMED_JSON", "SCHEMA_VIOLATION", "PERMANENT_PROCESSING_ERROR"]);

export type DeadLetterReason = z.output<typeof DeadLetterReasonSchema>;

/** Kafka coordinates of one record — unique per (topic, partition, offset). */
export interface KafkaCoordinates {
	readonly topic: string;
	readonly partition: number;
	readonly offset: string;
}

export interface DeadLetterInput extends KafkaCoordinates {
	readonly consumer: string;
	readonly eventId: string | null;
	readonly reason: DeadLetterReason;
	readonly error: string;
	readonly rawValue: string | null;
}

/** Metadata-only analytics row — tenant id tagged when present in the payload (no content). */
export interface AnalyticsEventRow {
	readonly eventId: string;
	readonly topic: string;
	readonly eventType: string;
	readonly correlationId: string | null;
	readonly partitionKey: string;
	readonly payload: {
		readonly eventId: string;
		readonly type: string;
		readonly correlationId: string | null;
		readonly organizationId: string | null;
		readonly occurredAt: number;
	};
	readonly occurredAt: number;
}

export interface InboxClaim {
	readonly consumer: string;
	readonly eventId: string;
	readonly topic: string;
	readonly eventType: string;
}

/** Writes that must commit atomically with the inbox claim. */
export interface InboxTransaction {
	/**
	 * Record `eventId` as processed by `consumer`. Returns false when it was
	 * already recorded (duplicate delivery) — the caller must then do nothing.
	 */
	claim(claim: InboxClaim): Promise<boolean>;
	insertAnalyticsEvent(row: AnalyticsEventRow): Promise<void>;
}

/** Persistence port for the consumer inbox (implemented by `PgInboxStore`). */
export interface InboxStore {
	/** Runs `work` in one database transaction — the claim and the side effect commit or roll back together. */
	inTransaction<T>(work: (tx: InboxTransaction) => Promise<T>): Promise<T>;
	/** Park a poison message. Idempotent per (consumer, topic, partition, offset). */
	park(deadLetter: DeadLetterInput): Promise<void>;
}
