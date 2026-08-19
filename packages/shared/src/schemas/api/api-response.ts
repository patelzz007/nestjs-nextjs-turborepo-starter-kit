import { z } from "zod";

import { EpochMsSchema, DataValueSchema, type DataValue } from "./common";

// ── Shared response envelope primitives ──────────────────────────────────

/**
 * Metadata included in every API response by the ResponseInterceptor.
 */
export const ApiResponseMetaSchema = z
	.object({
		correlationId: z.string().default("").meta({
			description: "Request tracing ID (from X-Correlation-Id header or auto-generated)",
			example: "abc123-def456",
		}),
		timestamp: EpochMsSchema.meta({
			description: "Epoch milliseconds when the response was generated",
			example: 1786300000000,
		}),
	})
	.strict();

export type ApiResponseMeta = z.output<typeof ApiResponseMetaSchema>;

/**
 * Paginated meta — extended metadata returned for paginated list endpoints.
 */
export const ApiPaginatedMetaSchema = ApiResponseMetaSchema.extend({
	total: z.number().int().min(0).meta({ description: "Total number of items across all pages", example: 42 }),
	page: z.number().int().min(1).meta({ description: "Current page number (1-based)", example: 1 }),
	limit: z.number().int().min(1).max(100).meta({ description: "Items per page", example: 20 }),
	totalPages: z.number().int().min(0).nullable().meta({ description: "Total number of pages", example: 3 }),
	hasNext: z.boolean().nullable().meta({ description: "Whether a next page exists", example: true }),
	hasPrevious: z.boolean().nullable().meta({ description: "Whether a previous page exists", example: false }),
}).strict();

export type ApiPaginatedMeta = z.output<typeof ApiPaginatedMetaSchema>;

/**
 * Standard success response envelope.
 * The `data` field contains the actual response payload.
 * Used by every successful endpoint response after the ResponseInterceptor.
 */
export const ApiSuccessResponseSchema = z
	.object({
		success: z.literal(true).meta({
			description: "Indicates the request was successful",
			example: true,
		}),
		data: DataValueSchema.meta({
			description: "The response payload — varies by endpoint",
		}),
		meta: ApiResponseMetaSchema,
	})
	.strict();

export type ApiSuccessResponse = z.output<typeof ApiSuccessResponseSchema>;

/**
 * Standard error response envelope.
 * Returned by the ResponseInterceptor when an exception is thrown.
 */
export const ApiErrorResponseSchema = z
	.object({
		success: z.literal(false).meta({
			description: "Indicates the request failed",
			example: false,
		}),
		error: z
			.object({
				message: z.string().meta({
					description: "Human-readable error message",
					example: "Invalid email or password",
				}),
				statusCode: z.number().int().meta({
					description: "HTTP status code",
					example: 401,
				}),
				error: z.string().optional().meta({
					description: "Error type / code (e.g. ACCESS_TOKEN_MISSING)",
					example: "Unauthorized",
				}),
			})
			.strict(),
		meta: ApiResponseMetaSchema,
	})
	.strict();

export type ApiErrorResponse = z.output<typeof ApiErrorResponseSchema>;

/**
 * The raw error body the API returns (unwrapped from the `{ success, error, meta }`
 * envelope). The base fields (`message`, `statusCode`, `error`) come from the
 * shared envelope's `.shape.error`, while `statusCode` is made optional here
 * because not every error response includes it. Client-only lockout fields
 * (`lockedUntil`, `remainingSeconds`) are added via `.extend()` so both the
 * API and the client agree on the shape and can never drift.
 */
export const ApiErrorBodySchema = ApiErrorResponseSchema.shape.error
	.extend({
		statusCode: z.number().int().optional(),
		lockedUntil: EpochMsSchema.optional(),
		remainingSeconds: z.number().optional(),
	});

export type ApiErrorBody = z.output<typeof ApiErrorBodySchema>;

/**
 * The envelope is an interface WITH an index signature: the index signature is
 * what makes `Envelope<Data> extends DataValue` provable for the defs' `Resp`
 * constraint (interfaces only get index-signature assignability when they
 * declare one), while staying a plain interface per the lint rules.
 */
export interface Envelope<Data extends DataValue> {
	readonly success: true;
	readonly data: Data;
	readonly meta: ApiResponseMeta;
	readonly [key: string]: DataValue | undefined;
}
