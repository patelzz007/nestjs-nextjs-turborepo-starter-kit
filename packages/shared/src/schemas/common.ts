import { z } from "zod";

/**
 * Schema for an ISO 8601 datetime string.
 *
 * Zod v4 cannot represent `z.date()` in JSON Schema / OpenAPI
 * (throws "Date cannot be represented in JSON Schema"), so we
 * use `z.iso.datetime()` instead of `z.date().transform(...)`.
 */
// z.string().datetime() is deprecated, but z.iso.datetime() has unresolvable
// types in strictTypeChecked so we use the deprecated API here.
// eslint-disable-next-line @typescript-eslint/no-deprecated
export const DateStringSchema = z.string().datetime({ offset: true });

/**
 * Base response schema for all database entity responses.
 *
 * Every entity response schema should extend this via `.extend()` so that
 * `createdAt`, `updatedAt`, `isDeleted`, and `deletedAt` are consistently
 * present across all endpoints.
 */
export const BaseResponseSchema = z
	.object({
		createdAt: DateStringSchema.meta({
			description: "ISO 8601 timestamp when the record was created",
			example: "2026-07-20T10:00:00.000Z",
		}),
		updatedAt: DateStringSchema.meta({
			description: "ISO 8601 timestamp when the record was last updated",
			example: "2026-07-20T10:00:00.000Z",
		}),
		isDeleted: z.boolean().meta({
			description: "Soft-delete flag — false means the record is active",
			example: false,
		}),
		deletedAt: DateStringSchema.nullable().meta({
			description: "ISO 8601 timestamp when soft-delete occurred, or null if active",
			example: null,
		}),
	})
	.strict();

export type BaseResponse = z.output<typeof BaseResponseSchema>;
