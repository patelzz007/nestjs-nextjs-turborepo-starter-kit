import { z } from "zod";

/**
 * Result of a cookie set/clear operation in the API `CookieService`.
 * `error` carries an `Error` instance (not JSON-serializable) — validated
 * with `instanceof` because it is never parsed from external input.
 */
export const CookieResultSchema = z.object({
	success: z.boolean(),
	error: z.custom<Error>((value): value is Error => value instanceof Error).optional(),
});

export type CookieResult = z.output<typeof CookieResultSchema>;
