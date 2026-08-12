import { z } from "zod";

import { EmailLogEntrySchema } from "../email/email";

// ── JSON value (rule 2: no z.unknown — a recursive union instead) ────────

/** A JSON-compatible value: strings, numbers, booleans, null, arrays, objects. */
export type TelescopeJsonValue = string | number | boolean | null | readonly TelescopeJsonValue[] | { readonly [key: string]: TelescopeJsonValue };

export const TelescopeJsonValueSchema: z.ZodType<TelescopeJsonValue> = z.lazy(() =>
	z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(TelescopeJsonValueSchema), z.record(z.string(), TelescopeJsonValueSchema)]),
);

// ── Timeline spans ─────────────────────────────────────────────────────────

export const TelescopeSpanKindSchema = z.enum(["middleware", "guard", "interceptor", "service", "prisma", "queue", "serialization", "other"]);

export type TelescopeSpanKind = z.output<typeof TelescopeSpanKindSchema>;

export const TelescopeSpanSchema = z
	.object({
		name: z.string(),
		kind: TelescopeSpanKindSchema,
		/** Milliseconds from the request start. */
		startOffsetMs: z.number().nonnegative(),
		durationMs: z.number().nonnegative(),
	})
	.strict();

export type TelescopeSpan = z.output<typeof TelescopeSpanSchema>;

// ── RequestLog ─────────────────────────────────────────────────────────────

/** Slim row for list views — everything a table cell needs, nothing more. */
export const RequestLogSummarySchema = z
	.object({
		id: z.string(),
		method: z.string(),
		path: z.string(),
		statusCode: z.number().int().nullable(),
		userId: z.string().nullable(),
		durationMs: z.number().int().nonnegative(),
		createdAt: z.string(),
	})
	.strict();

export type RequestLogSummary = z.output<typeof RequestLogSummarySchema>;

/** Full request entry — the detail view. */
export const RequestLogEntrySchema = RequestLogSummarySchema.extend({
	correlationId: z.string(),
	queryString: z.string().nullable(),
	ip: z.string().nullable(),
	userAgent: z.string().nullable(),
	/** Sanitized + truncated at capture time (see docs/telescope.md §10). */
	requestBody: TelescopeJsonValueSchema.nullable(),
	responseBody: TelescopeJsonValueSchema.nullable(),
	requestHeaders: z.record(z.string(), z.string()).nullable(),
	spans: z.array(TelescopeSpanSchema).readonly(),
}).strict();

export type RequestLogEntry = z.output<typeof RequestLogEntrySchema>;

// ── QueryLog ───────────────────────────────────────────────────────────────

export const QueryLogEntrySchema = z
	.object({
		id: z.string(),
		correlationId: z.string(),
		model: z.string(),
		operation: z.string(),
		query: z.string(),
		/** Sanitized bind-parameter JSON string. */
		params: z.string().nullable(),
		durationMs: z.number().int().nonnegative(),
		createdAt: z.string(),
	})
	.strict();

export type QueryLogEntry = z.output<typeof QueryLogEntrySchema>;

// ── ExceptionLog ───────────────────────────────────────────────────────────

export const ExceptionLogEntrySchema = z
	.object({
		id: z.string(),
		correlationId: z.string(),
		errorGroup: z.string(),
		name: z.string(),
		message: z.string(),
		stack: z.string().nullable(),
		statusCode: z.number().int().nullable(),
		path: z.string().nullable(),
		method: z.string().nullable(),
		userId: z.string().nullable(),
		occurrences: z.number().int().positive(),
		createdAt: z.string(),
	})
	.strict();

export type ExceptionLogEntry = z.output<typeof ExceptionLogEntrySchema>;

// ── Dump (the dd() equivalent) ─────────────────────────────────────────────

export const DumpEntrySchema = z
	.object({
		id: z.string(),
		name: z.string(),
		value: TelescopeJsonValueSchema,
		correlationId: z.string().nullable(),
		createdAt: z.string(),
	})
	.strict();

export type DumpEntry = z.output<typeof DumpEntrySchema>;

// ── Module options (docs/telescope.md §3 — the one config surface) ────────

export const TelescopeStorageSchema = z.enum(["memory", "postgres"]);
export type TelescopeStorage = z.output<typeof TelescopeStorageSchema>;

export const TelescopeBodyCaptureSchema = z.enum(["none", "headers", "full"]);
export type TelescopeBodyCapture = z.output<typeof TelescopeBodyCaptureSchema>;

export const TelescopeOptionsSchema = z
	.object({
		/** NODE_ENV=production forces false at boot unless explicitly true. */
		enabled: z.boolean().default(true),
		/** "postgres" is the opt-in persistence upgrade (not yet implemented). */
		storage: TelescopeStorageSchema.default("memory"),
		/** Memory ring-buffer cap. */
		maxRequests: z.number().int().positive().default(1000),
		captureBody: TelescopeBodyCaptureSchema.default("headers"),
		/** Header whitelist — nothing outside this list is ever stored. */
		captureHeaders: z.array(z.string()).default(["content-type", "user-agent", "x-client-type"]),
		ignorePaths: z.array(z.string()).default(["/health", "/docs", "/telescope", "/favicon.ico"]),
		sampling: z
			.object({
				dev: z.number().min(0).max(1).default(1),
				prod: z.number().min(0).max(1).default(0.01),
			})
			.strict(),
	})
	.strict();

export type TelescopeOptions = z.output<typeof TelescopeOptionsSchema>;

// ── Query DTOs (shared between the API DTOs and the client registry) ──────

export const TelescopePaginationSchema = z
	.object({
		page: z.coerce.number().int().positive().default(1),
		pageSize: z.coerce.number().int().positive().max(100).default(20),
	})
	.strict();

export const TelescopeRequestListQuerySchema = TelescopePaginationSchema.extend({
	method: z.string().optional(),
	path: z.string().optional(),
	status: z.coerce.number().int().optional(),
	minDurationMs: z.coerce.number().int().nonnegative().optional(),
	userId: z.string().optional(),
	correlationId: z.string().optional(),
	sort: z.enum(["newest", "duration"]).default("newest"),
	from: z.string().optional(),
	to: z.string().optional(),
}).strict();

export type TelescopeRequestListQuery = z.output<typeof TelescopeRequestListQuerySchema>;

export const TelescopeSqlListQuerySchema = TelescopePaginationSchema.extend({
	model: z.string().optional(),
	operation: z.string().optional(),
	minDurationMs: z.coerce.number().int().nonnegative().optional(),
	correlationId: z.string().optional(),
	sort: z.enum(["newest", "duration"]).default("duration"),
	from: z.string().optional(),
	to: z.string().optional(),
}).strict();

export type TelescopeSqlListQuery = z.output<typeof TelescopeSqlListQuerySchema>;

export const TelescopeExceptionListQuerySchema = TelescopePaginationSchema.extend({
	errorGroup: z.string().optional(),
	statusCode: z.coerce.number().int().optional(),
	from: z.string().optional(),
	to: z.string().optional(),
}).strict();

export type TelescopeExceptionListQuery = z.output<typeof TelescopeExceptionListQuerySchema>;

export const TelescopeRangeSchema = z.enum(["15m", "1h", "6h", "24h"]);
export type TelescopeRange = z.output<typeof TelescopeRangeSchema>;

export const TelescopeOverviewQuerySchema = z.object({ range: TelescopeRangeSchema.default("15m") }).strict();

export type TelescopeOverviewQuery = z.output<typeof TelescopeOverviewQuerySchema>;

// ── Response shapes ────────────────────────────────────────────────────────

export const TelescopeOverviewSchema = z
	.object({
		range: TelescopeRangeSchema,
		requests: z.number().int(),
		avgDurationMs: z.number(),
		p95DurationMs: z.number(),
		slowest: RequestLogSummarySchema.nullable(),
		errorCount: z.number().int(),
		sqlCount: z.number().int(),
		slowSqlCount: z.number().int(),
		mailSent: z.number().int(),
		mailDelivered: z.number().int(),
		exceptionGroups: z.number().int(),
	})
	.strict();

export type TelescopeOverview = z.output<typeof TelescopeOverviewSchema>;

export const TelescopeRequestListResponseSchema = z
	.object({
		items: z.array(RequestLogSummarySchema).readonly(),
		total: z.number().int(),
		page: z.number().int(),
		pageSize: z.number().int(),
	})
	.strict();

export type TelescopeRequestListResponse = z.output<typeof TelescopeRequestListResponseSchema>;

export const TelescopeSqlListResponseSchema = z
	.object({
		items: z.array(QueryLogEntrySchema).readonly(),
		total: z.number().int(),
		page: z.number().int(),
		pageSize: z.number().int(),
	})
	.strict();

export type TelescopeSqlListResponse = z.output<typeof TelescopeSqlListResponseSchema>;

export const TelescopeExceptionListResponseSchema = z
	.object({
		items: z.array(ExceptionLogEntrySchema).readonly(),
		total: z.number().int(),
		page: z.number().int(),
		pageSize: z.number().int(),
	})
	.strict();

export type TelescopeExceptionListResponse = z.output<typeof TelescopeExceptionListResponseSchema>;

/** Detail view: the request + its queries + its dumps (joined by correlationId). */
export const TelescopeRequestDetailResponseSchema = z
	.object({
		request: RequestLogEntrySchema,
		queries: z.array(QueryLogEntrySchema).readonly(),
		dumps: z.array(DumpEntrySchema).readonly(),
	})
	.strict();

export type TelescopeRequestDetailResponse = z.output<typeof TelescopeRequestDetailResponseSchema>;

export const TelescopeMailResponseSchema = z
	.object({
		logs: z.array(EmailLogEntrySchema).readonly(),
	})
	.strict();

export type TelescopeMailResponse = z.output<typeof TelescopeMailResponseSchema>;

export const TelescopeDumpInputSchema = z
	.object({
		name: z.string().min(1).max(100),
		value: TelescopeJsonValueSchema,
	})
	.strict();

export type TelescopeDumpInput = z.output<typeof TelescopeDumpInputSchema>;

export const TelescopeDumpResponseSchema = z.object({ id: z.string() }).strict();

export type TelescopeDumpResponse = z.output<typeof TelescopeDumpResponseSchema>;
