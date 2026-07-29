import { z } from "zod";

/**
 * A date represented as an ISO-8601 datetime string.
 *
 * Why `z.string().datetime()` instead of `z.date()`?
 * Zod v4 throws `Error: Date cannot be represented in JSON Schema` when
 * nestjs-zod tries to generate OpenAPI JSON Schema from `z.date()`.
 * Using `z.string().datetime()` is JSON-compatible and works with OpenAPI.
 *
 * Example value: "2026-07-28T12:00:00.000Z"
 */
export const DateStringSchema = z.string().datetime({ offset: true }).meta({
	description: "ISO-8601 datetime string",
	example: "2026-07-28T12:00:00.000Z",
});
