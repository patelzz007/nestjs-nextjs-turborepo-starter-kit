import { z } from "zod";

import { JsonObjectSchema } from "../runtime/json";
import { KafkaTopicSchema } from "./kafka";
import { EmailSendJobSchema } from "./queue";

export const OutboxEventStatusSchema = z.enum(["PENDING", "PUBLISHED", "FAILED"]);

export type OutboxEventStatus = z.output<typeof OutboxEventStatusSchema>;

export const OUTBOX_EVENT_STATUSES: readonly OutboxEventStatus[] = OutboxEventStatusSchema.options;

/** Row shape for the transactional outbox table. */
export const OutboxEventRecordSchema = z
	.object({
		id: z.uuid(),
		topic: KafkaTopicSchema,
		eventType: z.string().min(1),
		partitionKey: z.string().nullable(),
		correlationId: z.string().nullable(),
		payload: JsonObjectSchema,
		status: OutboxEventStatusSchema,
		attempts: z.number().int().nonnegative(),
		lastError: z.string().nullable(),
		publishedAt: z.number().int().nonnegative().nullable(),
		createdAt: z.number().int().nonnegative(),
		updatedAt: z.number().int().nonnegative(),
	})
	.strict();

export type OutboxEventRecord = z.output<typeof OutboxEventRecordSchema>;

/** Input for enqueueing a new outbox row. */
export const OutboxEnqueueInputSchema = z
	.object({
		topic: KafkaTopicSchema,
		eventType: z.string().min(1),
		partitionKey: z.string().nullable(),
		correlationId: z.string().nullable(),
		payload: JsonObjectSchema,
	})
	.strict();

export type OutboxEnqueueInput = z.output<typeof OutboxEnqueueInputSchema>;

/**
 * Outbox row type for a durable email request (ADR 060). The row is written in
 * the caller's transaction next to the `pending` email log row, and the API's
 * outbox relay hands it to the BullMQ `emailSend` queue. It is an INTERNAL
 * route: it is never published to Kafka, so it is not a platform event.
 */
export const NOTIFICATION_EMAIL_REQUESTED_EVENT_TYPE = "notification.email.requested";

/** `outbox_events.topic` of an email request row. Not a Kafka topic, so the Kafka relay never claims it. */
export const NOTIFICATION_EMAIL_OUTBOX_TOPIC = "internal.notifications.email";

/** The email request itself: exactly the `emailSend` job the relay enqueues (jobId = `emailLogId`). */
export const NotificationEmailRequestedPayloadSchema = EmailSendJobSchema;

export type NotificationEmailRequestedPayload = z.output<typeof NotificationEmailRequestedPayloadSchema>;

/** Stored `outbox_events.payload` of an email request row. */
export const NotificationEmailRequestedEnvelopeSchema = z
	.object({
		type: z.literal(NOTIFICATION_EMAIL_REQUESTED_EVENT_TYPE),
		correlationId: z.string().nullable(),
		occurredAt: z.number().int().nonnegative(),
		payload: NotificationEmailRequestedPayloadSchema,
	})
	.strict();

export type NotificationEmailRequestedEnvelope = z.output<typeof NotificationEmailRequestedEnvelopeSchema>;
