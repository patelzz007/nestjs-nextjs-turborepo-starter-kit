import { z } from "zod";

import { JsonObjectSchema } from "../runtime/json";

/** Generic platform audit record for generated resources. */
export const PlatformResourceAuditRecordSchema = z
	.object({
		id: z.uuid(),
		resourceType: z.string().min(1),
		resourceId: z.uuid(),
		action: z.string().min(1),
		actorUserId: z.uuid().nullable(),
		changes: JsonObjectSchema.nullable(),
		createdAt: z.number().int().nonnegative(),
	})
	.strict();

export type PlatformResourceAuditRecord = z.output<typeof PlatformResourceAuditRecordSchema>;

export const PlatformResourceAuditInputSchema = z
	.object({
		resourceType: z.string().min(1),
		resourceId: z.uuid(),
		action: z.string().min(1),
		actorUserId: z.uuid().nullable(),
		changes: JsonObjectSchema.nullable(),
	})
	.strict();

export type PlatformResourceAuditInput = z.output<typeof PlatformResourceAuditInputSchema>;

export const PlatformResourceIdempotencyRecordSchema = z
	.object({
		id: z.uuid(),
		scope: z.string().min(1),
		idempotencyKey: z.string().min(8).max(128),
		requestHash: z.string().min(1),
		responseBody: JsonObjectSchema,
		createdAt: z.number().int().nonnegative(),
	})
	.strict();

export type PlatformResourceIdempotencyRecord = z.output<typeof PlatformResourceIdempotencyRecordSchema>;

export const PlatformResourceIdempotencyInputSchema = z
	.object({
		scope: z.string().min(1),
		idempotencyKey: z.string().min(8).max(128),
		requestHash: z.string().min(1),
		responseBody: JsonObjectSchema,
	})
	.strict();

export type PlatformResourceIdempotencyInput = z.output<typeof PlatformResourceIdempotencyInputSchema>;
