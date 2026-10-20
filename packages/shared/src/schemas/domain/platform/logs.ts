import { z } from "zod";

/**
 * Valid log levels supported by the logging system.
 */
export const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);

export type LogLevel = z.output<typeof LogLevelSchema>;

/**
 * Schema for metadata values stored alongside log entries.
 */
export const MetadataValueSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

/**
 * Options for `LogService` methods (context, userId, structured metadata).
 */
export const LogServiceOptionsSchema = z
	.object({
		context: z.string().optional(),
		userId: z.string().optional(),
		metadata: MetadataValueSchema.optional(),
	})
	.strict();

export type LogServiceOptions = z.output<typeof LogServiceOptionsSchema>;
