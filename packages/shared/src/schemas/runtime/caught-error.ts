import { z } from "zod";

import { JsonValueSchema, type JsonValue } from "./json";

/** Values that can appear in a `catch` clause at runtime. */
export type CaughtValue = Error | undefined | JsonValue;

/** Values that can appear in a `catch` clause at runtime. */
export const CaughtValueSchema: z.ZodType<CaughtValue> = z.union([z.instanceof(Error), z.undefined(), JsonValueSchema]);

/** Resend-like rejection objects that carry an optional `code` and `message`. */
export const ResendLikeErrorSchema = z
	.object({
		code: z.string().optional(),
		message: z.string().optional(),
	})
	.strict();

export type ResendLikeError = z.output<typeof ResendLikeErrorSchema>;
