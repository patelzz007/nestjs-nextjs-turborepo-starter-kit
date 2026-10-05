import { z } from "zod";

const JsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

type JsonValueNode = z.output<typeof JsonPrimitiveSchema> | JsonValueNode[] | JsonObjectNode;

interface JsonObjectNode {
	readonly [key: string]: JsonValueNode;
}

/** Recursive JSON object — matches nested event payloads (e.g. reward metadata). */
const JsonValueSchema: z.ZodType<JsonValueNode> = z.lazy(() => z.union([JsonPrimitiveSchema, z.array(JsonValueSchema), JsonObjectSchema]));

const JsonObjectSchema: z.ZodType<JsonObjectNode> = z.lazy(() => z.record(z.string(), JsonValueSchema));

/**
 * Minimal JSON envelope for broker publish (Kafka, etc.). `eventId` is the
 * producer-assigned stable id (the outbox row id): a message republished after
 * a crash carries the same id, so consumer inboxes can dedupe on it.
 */
export const MessageEnvelopeSchema = z
	.object({
		eventId: z.uuid(),
		type: z.string().min(1),
		correlationId: z.string().nullable(),
		occurredAt: z.number().int().nonnegative(),
		payload: JsonObjectSchema,
	})
	.strict();

export type MessageEnvelope = z.output<typeof MessageEnvelopeSchema>;
