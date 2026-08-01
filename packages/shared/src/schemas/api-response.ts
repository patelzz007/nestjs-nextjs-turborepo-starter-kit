import { z } from "zod";

import { DateStringSchema } from "./common";

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
		timestamp: DateStringSchema.meta({
			description: "ISO-8601 timestamp when the response was generated",
			example: "2026-07-30T10:00:00.000Z",
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
		data: z.unknown().meta({
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
