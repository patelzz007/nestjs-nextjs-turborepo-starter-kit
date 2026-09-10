import { z } from "zod";

const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

type JsonValueNode = z.output<typeof JsonPrimitiveSchema> | JsonValueNode[] | JsonObjectNode;

interface JsonObjectNode {
	readonly [key: string]: JsonValueNode;
}

/** Recursive JSON object — matches nested event payloads (e.g. reward metadata). */
const JsonValueSchema: z.ZodType<JsonValueNode> = z.lazy(() => z.union([JsonPrimitiveSchema, z.array(JsonValueSchema), JsonObjectSchema]));

const JsonObjectSchema: z.ZodType<JsonObjectNode> = z.lazy(() => z.record(z.string(), JsonValueSchema));

export const OUTBOX_EVENT_STATUSES: ["PENDING", "PUBLISHED", "FAILED"] = ["PENDING", "PUBLISHED", "FAILED"];

export const OutboxEventStatusSchema = z.enum(OUTBOX_EVENT_STATUSES);

export type OutboxEventStatus = z.output<typeof OutboxEventStatusSchema>;

/** Generic transactional outbox row — topic is an app-defined string. */
export const OutboxEventRecordSchema = z
	.object({
		id: z.uuid(),
		topic: z.string().min(1),
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
		topic: z.string().min(1),
		eventType: z.string().min(1),
		partitionKey: z.string().nullable(),
		correlationId: z.string().nullable(),
		payload: JsonObjectSchema,
	})
	.strict();

export type OutboxEnqueueInput = z.output<typeof OutboxEnqueueInputSchema>;

/** Minimal JSON envelope for broker publish (Kafka, etc.). */
export const MessageEnvelopeSchema = z
	.object({
		type: z.string().min(1),
		correlationId: z.string().nullable(),
		occurredAt: z.number().int().nonnegative(),
		payload: JsonObjectSchema,
	})
	.strict();

export type MessageEnvelope = z.output<typeof MessageEnvelopeSchema>;
