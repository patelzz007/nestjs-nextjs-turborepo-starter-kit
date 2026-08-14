import { z } from "zod";

import { EpochMsSchema } from "../api/common";

/**
 * Valid log levels supported by the logging system.
 */
export const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);

export type LogLevel = z.infer<typeof LogLevelSchema>;

/**
 * Schema for metadata values stored alongside log entries.
 */
export const MetadataValueSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

export const LogEntrySchema = z.object({
	id: z.string(),
	level: LogLevelSchema,
	message: z.string(),
	context: z.string().nullable(),
	userId: z.string().nullable(),
	correlationId: z.string().nullable(),
	metadata: MetadataValueSchema.nullable(),
	durationMs: z.number().nullable(),
	errorGroup: z.string().nullable(),
	tags: z.array(z.string()),
	timestamp: EpochMsSchema,
	createdAt: EpochMsSchema,
});

export type LogEntry = z.output<typeof LogEntrySchema>;

/**
 * Input options passed to LogService log methods.
 * All fields are optional — only `message` is required (enforced by the method signature).
 */
export const LogInputSchema = z.object({
	message: z.string().min(1, "Log message cannot be empty"),
	context: z.string().optional(),
	userId: z.string().optional(),
	correlationId: z.string().optional(),
	metadata: MetadataValueSchema.optional(),
});

export type LogInput = z.input<typeof LogInputSchema>;

/**
 * Schema for a single level count entry used in log statistics.
 */
export const LevelCountSchema = z.object({
	level: z.string(),
	count: z.number().int(),
});

export type LevelCount = z.input<typeof LevelCountSchema>;

export const LogQuerySchema = z.object({
	level: LogLevelSchema.optional(),
	context: z.string().optional(),
	userId: z.string().optional(),
	search: z.string().optional(),
	searchFields: z.string().optional(),
	correlationId: z.string().optional(),
	errorGroup: z.string().optional(),
	tags: z.string().optional(),
	from: EpochMsSchema.optional(),
	to: EpochMsSchema.optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
	limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type LogQuery = z.output<typeof LogQuerySchema>;

export const LogStatsQuerySchema = z.object({
	from: EpochMsSchema.optional(),
	to: EpochMsSchema.optional(),
});

export type LogStatsQuery = z.output<typeof LogStatsQuerySchema>;

export const LogStatsSchema = z.object({
	total: z.number(),
	byLevel: z.array(z.object({ level: z.string(), count: z.number() })),
	topContexts: z.array(z.object({ context: z.string(), count: z.number() })),
	busiestHour: z.number().int().nullable(),
	errorRate: z.number(),
});

export type LogStats = z.output<typeof LogStatsSchema>;

export const LogAggregationQuerySchema = z.object({
	granularity: z.enum(["hour", "day", "week"]).optional().default("hour"),
	from: EpochMsSchema.optional(),
	to: EpochMsSchema.optional(),
});

export type LogAggregationQuery = z.output<typeof LogAggregationQuerySchema>;

export const AggregatedLogSchema = z.object({
	period: z.string(),
	level: z.string(),
	count: z.number(),
});

export type AggregatedLog = z.output<typeof AggregatedLogSchema>;

export const ErrorGroupQuerySchema = z.object({
	from: EpochMsSchema.optional(),
	to: EpochMsSchema.optional(),
	minCount: z.coerce.number().int().min(1).optional().default(2),
});

export type ErrorGroupQuery = z.output<typeof ErrorGroupQuerySchema>;

export const ErrorGroupSchema = z.object({
	errorGroup: z.string(),
	message: z.string(),
	count: z.number(),
	firstOccurrence: EpochMsSchema,
	lastOccurrence: EpochMsSchema,
});

export type ErrorGroup = z.output<typeof ErrorGroupSchema>;

export const LogExportQuerySchema = z.object({
	format: z.enum(["csv", "txt", "json", "pdf"]).optional().default("pdf"),
	color: z.enum(["true", "false"]).optional().default("true"),
	level: LogLevelSchema.optional(),
	context: z.string().optional(),
	userId: z.string().optional(),
	search: z.string().optional(),
	tags: z.string().optional(),
	from: EpochMsSchema.optional(),
	to: EpochMsSchema.optional(),
	limit: z.coerce.number().int().min(1).max(10000).optional().default(1000),
});

export type LogExportQuery = z.output<typeof LogExportQuerySchema>;

export const LogBulkDeleteQuerySchema = z.object({
	level: LogLevelSchema.optional(),
	context: z.string().optional(),
	userId: z.string().optional(),
	tags: z.string().optional(),
	from: EpochMsSchema.optional(),
	to: EpochMsSchema.optional(),
});

export type LogBulkDeleteQuery = z.output<typeof LogBulkDeleteQuerySchema>;

export const LogEmailReportQuerySchema = z.object({
	email: z.email(),
	level: LogLevelSchema.optional(),
	context: z.string().optional(),
	userId: z.string().optional(),
	search: z.string().optional(),
	tags: z.string().optional(),
	from: EpochMsSchema.optional(),
	to: EpochMsSchema.optional(),
	limit: z.coerce.number().int().min(1).max(10000).optional().default(1000),
});

export type LogEmailReportQuery = z.output<typeof LogEmailReportQuerySchema>;
