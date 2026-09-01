import { z } from "zod";

/** Plain string value — runtime narrowing without inline `z.string()`. */
export const StringValueSchema = z.string();

export type StringValue = z.output<typeof StringValueSchema>;

/** Non-empty string — common header/param/token guard. */
export const NonEmptyStringSchema = z.string().min(1);

export type NonEmptyString = z.output<typeof NonEmptyStringSchema>;

/** Minimal `{ message: string }` shape for normalizing thrown errors. */
export const ThrownErrorSchema = z
	.object({
		message: z.string(),
	})
	.strict();

export type ThrownError = z.output<typeof ThrownErrorSchema>;

/** String-to-string map (HTTP headers, replay targets, …). */
export const StringRecordSchema = z.record(z.string(), z.string());

export type StringRecord = z.output<typeof StringRecordSchema>;

/** Nullable string-to-string map. */
export const StringRecordNullableSchema = StringRecordSchema.nullable();

export type StringRecordNullable = z.output<typeof StringRecordNullableSchema>;
