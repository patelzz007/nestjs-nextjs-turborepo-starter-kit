import { z } from "zod";

import { JsonObjectSchema } from "../runtime/json";
import { KafkaTopicSchema } from "./kafka";

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
