import { z } from "zod";

import { DateStringSchema } from "./date.schema.js";

/**
 * Base schema extended by all response schemas.
 * Provides consistent timestamp and soft-delete fields.
 *
 * All dates are ISO-8601 strings (Zod v4 compatible — no z.date()).
 */
export const BaseResponseSchema = z
	.object({
		createdAt: DateStringSchema.meta({
			description: "ISO-8601 timestamp of when the record was created",
			example: "2026-07-28T12:00:00.000Z",
		}),
		updatedAt: DateStringSchema.meta({
			description: "ISO-8601 timestamp of the last update",
			example: "2026-07-28T12:30:00.000Z",
		}),
		isDeleted: z.boolean().meta({
			description: "Soft-delete flag",
		}),
		deletedAt: DateStringSchema.nullable().meta({
			description: "ISO-8601 timestamp of soft-deletion (null if active)",
			example: null,
		}),
	})
	.strict();
