import { z } from "zod";

/**
 * Epoch milliseconds (UTC) — the single time representation across the DB,
 * API, and UI. Branded (via Zod's `$brand`) so an ISO string or any other
 * plain number can never silently flow where a timestamp is expected.
 */
export type EpochMs = z.output<typeof EpochMsSchema>;

/**
 * Zod schema for epoch-ms timestamps. Runtime validation accepts any
 * non-negative integer (milliseconds); the output type is branded `EpochMs`
 * so consumers get strict typing and ISO-string regressions fail to compile.
 */
export const EpochMsSchema = z.number().int().nonnegative().brand("EpochMs");

/** The one sanctioned way to stamp "now" as an epoch-ms value. */
export function nowEpochMs(): EpochMs {
	return EpochMsSchema.parse(Date.now());
}

/**
 * Convert a plain number to an `EpochMs`. Normalizes non-integer inputs
 * (e.g. bucket-boundary math like `fromMs + i * (span / 24)`) by rounding to
 * the nearest millisecond before validating.
 */
export function epochMs(value: number): EpochMs {
	return EpochMsSchema.parse(Math.round(value));
}

/**
 * Base response schema for all database entity responses.
 *
 * Every entity response schema should extend this via `.extend()` so that
 * `createdAt`, `updatedAt`, `isDeleted`, and `deletedAt` are consistently
 * present across all endpoints. All timestamps are epoch milliseconds.
 */
export const BaseResponseSchema = z
	.object({
		createdAt: EpochMsSchema.meta({
			description: "Epoch milliseconds when the record was created",
			example: 1786300000000,
		}),
		updatedAt: EpochMsSchema.meta({
			description: "Epoch milliseconds when the record was last updated",
			example: 1786300000000,
		}),
		isDeleted: z.boolean().meta({
			description: "Soft-delete flag — false means the record is active",
			example: false,
		}),
		deletedAt: EpochMsSchema.nullable().meta({
			description: "Epoch milliseconds when soft-delete occurred, or null if active",
			example: null,
		}),
	})
	.strict();

export type BaseResponse = z.output<typeof BaseResponseSchema>;
