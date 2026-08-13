import { z } from "zod";

import { EmailLogEntrySchema } from "../email/email";

// ── JSON value (rule 2: no z.unknown — a recursive union instead) ────────

/** A JSON-compatible value: strings, numbers, booleans, null, arrays, objects. */
export type TelescopeJsonValue = string | number | boolean | null | readonly TelescopeJsonValue[] | { readonly [key: string]: TelescopeJsonValue };

export const TelescopeJsonValueSchema: z.ZodType<TelescopeJsonValue> = z.lazy(() =>
	z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(TelescopeJsonValueSchema), z.record(z.string(), TelescopeJsonValueSchema)]),
);

// ── Per-request console capture (improvement 16) ───────────────────────────
// Declared before RequestLogEntrySchema, which references it.

export const TelescopeLogLevelSchema = z.enum(["debug", "info", "warn", "error"]);
export type TelescopeLogLevel = z.output<typeof TelescopeLogLevelSchema>;

export const TelescopeLogEntrySchema = z
	.object({
		level: TelescopeLogLevelSchema,
		/** Sanitized + length-capped message text. */
		message: z.string(),
		timestamp: z.string(),
	})
	.strict();

export type TelescopeLogEntry = z.output<typeof TelescopeLogEntrySchema>;

// ── Environment tags (feature 8 — tag captures with NODE_ENV/host) ────────
// Declared before RequestLogEntrySchema, which references it.

export const TelescopeEnvironmentSchema = z
	.object({
		nodeEnv: z.string(),
		host: z.string(),
	})
	.strict();

export type TelescopeEnvironment = z.output<typeof TelescopeEnvironmentSchema>;

// ── Cache inspection (feature 5 — per-request cache hit/miss ops) ──────────
// Declared before RequestLogEntrySchema, which references it.

export const TelescopeCacheOperationSchema = z.enum(["get", "set", "delete"]);
export type TelescopeCacheOperation = z.output<typeof TelescopeCacheOperationSchema>;

export const TelescopeCacheOpSchema = z
	.object({
		operation: TelescopeCacheOperationSchema,
		/** Cache key (truncated at capture). */
		key: z.string(),
		/** `null` for write ops (set/delete); true/false for get. */
		hit: z.boolean().nullable(),
		durationMs: z.number().int().nonnegative(),
		at: z.string(),
	})
	.strict();
export type TelescopeCacheOp = z.output<typeof TelescopeCacheOpSchema>;

// ── PII scanner (feature 17 — flag + redact PII by default) ────────────────
// Declared before RequestLogEntrySchema, which references it.

export const TelescopePiiCategorySchema = z.enum(["email", "phone", "jwt", "ssn", "creditCard"]);
export type TelescopePiiCategory = z.output<typeof TelescopePiiCategorySchema>;

export const TelescopePiiFlagSchema = z
	.object({
		category: TelescopePiiCategorySchema,
		count: z.number().int().nonnegative(),
	})
	.strict();
export type TelescopePiiFlag = z.output<typeof TelescopePiiFlagSchema>;

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
		/** Environment tag (feature 8) — null for pre-upgrade/persisted rows. */
		environment: TelescopeEnvironmentSchema.nullable().default(null),
		/** Starred via request annotations (feature 14). */
		starred: z.boolean().default(false),
		/** N+1 warning count for this request's queries (improvement 4 — surfaced on the list). */
		n1WarningCount: z.number().int().nonnegative().default(0),
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
	/** Console output that ran inside the request's async context (improvement 16). */
	logs: z.array(TelescopeLogEntrySchema).readonly().default([]),
	/** Resolved route params (feature 6 — handler spans with params). */
	handlerParams: z.record(z.string(), z.string()).nullable().default(null),
	/** Per-request cache ops (feature 5). */
	cacheOps: z.array(TelescopeCacheOpSchema).readonly().default([]),
	/** PII categories found + redacted at capture (feature 17). */
	piiFlags: z.array(TelescopePiiFlagSchema).readonly().default([]),
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
		/** Offset from the request start (feature 11 — query overlay on the timeline). */
		startOffsetMs: z.number().int().nonnegative().default(0),
		createdAt: z.string(),
	})
	.strict();

export type QueryLogEntry = z.output<typeof QueryLogEntrySchema>;

// ── ExceptionLog ───────────────────────────────────────────────────────────
// ── Exception triage (improvement 6 — resolve/ignore per error group) ─────
// Declared BEFORE ExceptionLogEntrySchema, which references it.

export const TelescopeExceptionStatusSchema = z.enum(["open", "resolved", "ignored"]);
export type TelescopeExceptionStatus = z.output<typeof TelescopeExceptionStatusSchema>;

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
		/** Group-aggregation fields (improvement 15): first/last occurrence. */
		firstSeenAt: z.string(),
		lastSeenAt: z.string(),
		/** Triage status (improvement 6) — default open; resolved/ignored hide the group. */
		status: TelescopeExceptionStatusSchema.default("open"),
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

/** Improvement 15 — "redact" masks PII at capture; "flag" only records the category. */
export const TelescopePiiModeSchema = z.enum(["redact", "flag"]);
export type TelescopePiiMode = z.output<typeof TelescopePiiModeSchema>;

export const TelescopeBodyCaptureSchema = z.enum(["none", "headers", "full"]);
export type TelescopeBodyCapture = z.output<typeof TelescopeBodyCaptureSchema>;

export const TelescopeOptionsSchema = z
	.object({
		/** NODE_ENV=production forces false at boot unless explicitly true. */
		enabled: z.boolean().default(true),
		/** "postgres" is the opt-in persistence upgrade (improvement 1 — shipped). */
		storage: TelescopeStorageSchema.default("memory"),
		/** Memory ring-buffer cap. */
		maxRequests: z.number().int().positive().default(10000),
		/** Serialization budget for stored request/response bodies (chars). */
		maxBodyChars: z.number().int().positive().default(2000),
		/** Entries older than this (minutes) are pruned by the retention task. */
		retentionMinutes: z.number().int().positive().default(1440),
		/** Optional allowlist: when set, ONLY paths under these prefixes are captured. */
		capturePaths: z.array(z.string()).optional(),
		/** Extra denylist on top of `ignorePaths` (e.g. PII-heavy endpoints). */
		redactPaths: z.array(z.string()).default([]),
		/** Optional shared secret accepted as `Authorization: Bearer <token>`. */
		token: z.string().optional(),
		/** Improvement 14 — cap on timeline spans stored per request (long tail protection). */
		maxSpansPerRequest: z.number().int().positive().default(200),
		/** Improvement 14 — cap on console output lines stored per request. */
		maxConsoleEntriesPerRequest: z.number().int().positive().default(100),
		/** Improvement 15 — "redact" masks PII at capture; "flag" only records the category. */
		piiMode: TelescopePiiModeSchema.default("redact"),
		captureBody: TelescopeBodyCaptureSchema.default("headers"),
		/** Header whitelist — nothing outside this list is ever stored. */
		captureHeaders: z.array(z.string()).default(["content-type", "user-agent", "x-client-type"]),
		ignorePaths: z.array(z.string()).default(["/health", "/docs", "/telescope", "/favicon.ico"]),
		/** Feature 18 — alert webhook URL; alerts fire only when this is set. */
		alertWebhookUrl: z.string().optional(),
		/** Feature 18 — duration threshold (ms) that triggers a "duration" alert. */
		alertDurationMs: z.number().int().positive().default(2000),
		/** Feature 18 — per-route+reason dedupe window (minutes). */
		alertWindowMinutes: z.number().int().positive().default(5),
		/** Feature 7 — named replay targets ({ name: baseUrl }); `local` always exists. */
		replayTargets: z.record(z.string(), z.string()).default({}),
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
	/** Environment-tag filter (feature 8) — matches `environment.nodeEnv`. */
	env: z.string().optional(),
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
	/** Triage status filter (improvement 6). */
	status: TelescopeExceptionStatusSchema.optional(),
	from: z.string().optional(),
	to: z.string().optional(),
}).strict();

export type TelescopeExceptionListQuery = z.output<typeof TelescopeExceptionListQuerySchema>;

/** Body for `PUT /telescope/exceptions/:id/status` (improvement 6). */
export const TelescopeExceptionStatusInputSchema = z
	.object({
		status: TelescopeExceptionStatusSchema,
	})
	.strict();
export type TelescopeExceptionStatusInput = z.output<typeof TelescopeExceptionStatusInputSchema>;

export const TelescopeRangeSchema = z.enum(["15m", "1h", "6h", "24h"]);
export type TelescopeRange = z.output<typeof TelescopeRangeSchema>;

export const TelescopeOverviewQuerySchema = z.object({ range: TelescopeRangeSchema.default("15m") }).strict();

export type TelescopeOverviewQuery = z.output<typeof TelescopeOverviewQuerySchema>;

// ── Response shapes ────────────────────────────────────────────────────────

/** One bucket of the overview traffic time-series (improvement v2 — sparkline). */
export const TelescopeTrafficPointSchema = z
	.object({
		/** Bucket start time (ISO). */
		t: z.string(),
		requests: z.number().int().nonnegative(),
		errors: z.number().int().nonnegative(),
	})
	.strict();

export type TelescopeTrafficPoint = z.output<typeof TelescopeTrafficPointSchema>;

/** Status-class counts for the overview (2xx/3xx/4xx/5xx + aborted/unknown). */ export const TelescopeStatusCountsSchema = z
	.object({
		"2xx": z.number().int().nonnegative(),
		"3xx": z.number().int().nonnegative(),
		"4xx": z.number().int().nonnegative(),
		"5xx": z.number().int().nonnegative(),
		other: z.number().int().nonnegative(),
	})
	.strict();
export type TelescopeStatusCounts = z.output<typeof TelescopeStatusCountsSchema>;

/** Capture-pipeline health snapshot (improvement 19 — overview health card). */
export const TelescopeHealthSchema = z
	.object({
		/** Backing store: "memory" or "postgres". */
		mode: TelescopeStorageSchema,
		/** Whether capture is currently active (false = fail-closed). */
		enabled: z.boolean(),
		/** Requests currently held in the buffer. */
		bufferRequests: z.number().int().nonnegative(),
		/** Ring-buffer cap (memory mode) or 0 for postgres mode. */
		bufferCap: z.number().int().nonnegative(),
		/** Current retention window in minutes. */
		retentionMinutes: z.number().int().positive(),
	})
	.strict();
export type TelescopeHealth = z.output<typeof TelescopeHealthSchema>;

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
		/** Requests with at least one N+1 warning in range (improvement 4). */
		n1RequestCount: z.number().int(),
		/** Requests with PII flags in range (improvement 15). */
		piiRequestCount: z.number().int(),
		/** Request volume over the range — 24 fixed buckets for the sparkline. */
		traffic: z.array(TelescopeTrafficPointSchema).readonly(),
		/** Status-class counts over the range. */
		statusCounts: TelescopeStatusCountsSchema,
		/** Environment tag of the process that captured (feature 8). */
		environment: TelescopeEnvironmentSchema,
		/** Capture-pipeline health snapshot (improvement 19). */
		health: TelescopeHealthSchema,
	})
	.strict();
export type TelescopeOverview = z.output<typeof TelescopeOverviewSchema>;

// ── N+1 detection (improvement 7) ──────────────────────────────────────────

/** A single N+1 warning: the same model+operation repeated ≥ 5× in a request. */
export const TelescopeN1WarningSchema = z
	.object({
		model: z.string(),
		operation: z.string(),
		count: z.number().int().positive(),
		totalMs: z.number().int().nonnegative(),
	})
	.strict();

export type TelescopeN1Warning = z.output<typeof TelescopeN1WarningSchema>;

// ── Request compare (improvement 6) ────────────────────────────────────────

export const TelescopeCompareQuerySchema = z
	.object({
		a: z.string().min(1),
		b: z.string().min(1),
	})
	.strict();

export type TelescopeCompareQuery = z.output<typeof TelescopeCompareQuerySchema>;

/** One scalar difference between two compared requests. */
export const TelescopeDiffFieldSchema = z
	.object({
		field: z.string(),
		valueA: z.string().nullable(),
		valueB: z.string().nullable(),
		same: z.boolean(),
	})
	.strict();

export type TelescopeDiffField = z.output<typeof TelescopeDiffFieldSchema>;
export const TelescopeCompareResponseSchema = z
	.object({
		a: RequestLogEntrySchema,
		b: RequestLogEntrySchema,
		diffs: z.array(TelescopeDiffFieldSchema).readonly(),
		/** Queries for each side — powers the side-by-side SQL diff (feature 15). */
		queriesA: z.array(QueryLogEntrySchema).readonly(),
		queriesB: z.array(QueryLogEntrySchema).readonly(),
	})
	.strict();
export type TelescopeCompareResponse = z.output<typeof TelescopeCompareResponseSchema>;

// ── Live stream (improvement 2) ────────────────────────────────────────────
// The status enums are declared here (before the stream schema) because the
// stream frames reference them for `job` / `schedule` events.

export const TelescopeJobStatusSchema = z.enum(["succeeded", "failed", "running"]);
export type TelescopeJobStatus = z.output<typeof TelescopeJobStatusSchema>;

export const TelescopeScheduleStatusSchema = z.enum(["succeeded", "failed", "pending"]);
export type TelescopeScheduleStatus = z.output<typeof TelescopeScheduleStatusSchema>;

/**
 * Stream frames are a strict discriminated union on `type`: each variant
 * carries exactly its own fields (extra fields are rejected by `.strict()`),
 * so a `job` frame can never smuggle request-only fields or vice versa.
 * Consumers narrow on `event.type` and get precise per-variant typing.
 *
 * Frames also carry a monotonically increasing `seq` (assigned by the event
 * bus) used for SSE replay (improvement 7) — the `seq` is transported as the
 * SSE `id:` field, never inside the JSON payload.
 */
export const TelescopeRequestStreamEventSchema = z
	.object({
		type: z.literal("request"),
		id: z.string(),
		method: z.string(),
		path: z.string(),
		statusCode: z.number().int().nullable(),
		durationMs: z.number().int().nonnegative(),
	})
	.strict();

export const TelescopeExceptionStreamEventSchema = z
	.object({
		type: z.literal("exception"),
		id: z.string(),
		name: z.string(),
		message: z.string(),
		statusCode: z.number().int(),
	})
	.strict();

export const TelescopeJobStreamEventSchema = z
	.object({
		type: z.literal("job"),
		id: z.string(),
		jobName: z.string(),
		jobStatus: TelescopeJobStatusSchema,
		durationMs: z.number().int().nonnegative().optional(),
		/** Correlation to the request the job ran inside (null for background work). */
		correlationId: z.string().nullable().default(null),
	})
	.strict();

export const TelescopeScheduleStreamEventSchema = z
	.object({
		type: z.literal("schedule"),
		id: z.string(),
		scheduleName: z.string(),
		scheduleStatus: TelescopeScheduleStatusSchema,
		durationMs: z.number().int().nonnegative().optional(),
	})
	.strict();

export const TelescopeStreamEventSchema = z.discriminatedUnion("type", [
	TelescopeRequestStreamEventSchema,
	TelescopeExceptionStreamEventSchema,
	TelescopeJobStreamEventSchema,
	TelescopeScheduleStreamEventSchema,
]);

export type TelescopeStreamEvent = z.output<typeof TelescopeStreamEventSchema>;

/**
 * A published stream frame stamped with its monotonic sequence number. The
 * `seq` is transported as the SSE `id:` field — a reconnecting client sends
 * `Last-Event-ID` and the server replays the buffered frames after it
 * (improvement 7).
 */
export interface BufferedStreamEvent {
	readonly seq: number;
	readonly event: TelescopeStreamEvent;
}

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

export type TelescopeExceptionListResponse = z.output<typeof TelescopeExceptionListResponseSchema>; // ── Annotations (feature 14 — star/comment a request) ──────────────────────
// Declared BEFORE TelescopeRequestDetailResponseSchema, which references it.

export const TelescopeAnnotationSchema = z
	.object({
		starred: z.boolean(),
		comment: z.string(),
		updatedAt: z.string(),
	})
	.strict();
export type TelescopeAnnotation = z.output<typeof TelescopeAnnotationSchema>;

export const TelescopeAnnotationInputSchema = z
	.object({
		starred: z.boolean().optional(),
		comment: z.string().max(2000).optional(),
	})
	.strict();
export type TelescopeAnnotationInput = z.output<typeof TelescopeAnnotationInputSchema>;

/** Detail view: the request + its annotation + navigation context (improvements 3/12/18). */
export const TelescopeRequestDetailResponseSchema = z
	.object({
		request: RequestLogEntrySchema,
		/** Star/comment annotation (feature 14) — null until first set. */
		annotation: TelescopeAnnotationSchema.nullable().default(null),
		/** Neighbor request ids by capture order (improvement 12 — prev/next nav). */
		adjacent: z
			.object({
				/** The request captured immediately before this one, or null. */
				prevId: z.string().nullable(),
				/** The request captured immediately after this one, or null. */
				nextId: z.string().nullable(),
			})
			.strict(),
		/** Nearest earlier request with the same method+path (improvement 18 — compare). */
		previousRequestId: z.string().nullable(),
	})
	.strict();
export type TelescopeRequestDetailResponse = z.output<typeof TelescopeRequestDetailResponseSchema>;

/** Lazy detail payload (improvement 3): SQL + dumps + N+1 warnings, fetched on demand. */
export const TelescopeRequestSqlResponseSchema = z
	.object({
		queries: z.array(QueryLogEntrySchema).readonly(),
		dumps: z.array(DumpEntrySchema).readonly(),
		n1Warnings: z.array(TelescopeN1WarningSchema).readonly(),
	})
	.strict();
export type TelescopeRequestSqlResponse = z.output<typeof TelescopeRequestSqlResponseSchema>;

// ── Jobs (feature 3 — queue/job inspection) ────────────────────────────────
// A job is any async unit of work recorded by `TelescopeJobRunner` — the
// seam is deliberately queue-agnostic (works with BullMQ, a custom executor,
// or a plain fire-and-forget task). Queue latency = startedAt - enqueuedAt.

export const TelescopeJobLogEntrySchema = z
	.object({
		id: z.string(),
		jobName: z.string(),
		status: TelescopeJobStatusSchema,
		durationMs: z.number().int().nonnegative().nullable(),
		/** Approximate JSON payload size in bytes (0 when no payload passed). */
		payloadSize: z.number().int().nonnegative().default(0),
		error: z.string().nullable(),
		correlationId: z.string().nullable(),
		enqueuedAt: z.string(),
		startedAt: z.string().nullable(),
		finishedAt: z.string().nullable(),
	})
	.strict();
export type TelescopeJobLogEntry = z.output<typeof TelescopeJobLogEntrySchema>;

export const TelescopeJobsListQuerySchema = TelescopePaginationSchema.extend({
	status: TelescopeJobStatusSchema.optional(),
}).strict();
export type TelescopeJobsListQuery = z.output<typeof TelescopeJobsListQuerySchema>;

export const TelescopeJobsListResponseSchema = z
	.object({
		items: z.array(TelescopeJobLogEntrySchema).readonly(),
		total: z.number().int(),
		page: z.number().int(),
		pageSize: z.number().int(),
	})
	.strict();
export type TelescopeJobsListResponse = z.output<typeof TelescopeJobsListResponseSchema>;

// ── Schedules (feature 4 — scheduled-task view) ────────────────────────────
// One row per registered schedule, keeping the last run + the next run.

/** One entry in a schedule's run history (improvement 20 — last N runs). */
export const TelescopeScheduleRunSchema = z
	.object({
		/** ISO timestamp of the run's start. */
		at: z.string(),
		status: TelescopeScheduleStatusSchema,
		durationMs: z.number().int().nonnegative().nullable(),
	})
	.strict();
export type TelescopeScheduleRun = z.output<typeof TelescopeScheduleRunSchema>;

export const TelescopeScheduleLogSchema = z
	.object({
		name: z.string(),
		cron: z.string(),
		status: TelescopeScheduleStatusSchema,
		lastRunAt: z.string().nullable(),
		lastDurationMs: z.number().int().nonnegative().nullable(),
		lastError: z.string().nullable(),
		nextRunAt: z.string(),
		/** Improvement 20 — recent run history (oldest-first, capped by the scheduler). */
		history: z.array(TelescopeScheduleRunSchema).readonly().default([]),
	})
	.strict();
export type TelescopeScheduleLog = z.output<typeof TelescopeScheduleLogSchema>;

export const TelescopeSchedulesResponseSchema = z
	.object({
		items: z.array(TelescopeScheduleLogSchema).readonly(),
	})
	.strict();
export type TelescopeSchedulesResponse = z.output<typeof TelescopeSchedulesResponseSchema>;

// ── Leaderboard (feature 12 — slow-endpoint leaderboard) ───────────────────

export const TelescopeLeaderboardEntrySchema = z
	.object({
		/** `METHOD /path` — the grouped route identity. */
		route: z.string(),
		method: z.string(),
		path: z.string(),
		count: z.number().int().positive(),
		avgMs: z.number().nonnegative(),
		p95Ms: z.number().nonnegative(),
		maxMs: z.number().nonnegative(),
		errorCount: z.number().int().nonnegative(),
	})
	.strict();
export type TelescopeLeaderboardEntry = z.output<typeof TelescopeLeaderboardEntrySchema>;

export const TelescopeLeaderboardResponseSchema = z
	.object({
		range: TelescopeRangeSchema,
		entries: z.array(TelescopeLeaderboardEntrySchema).readonly(),
	})
	.strict();
export type TelescopeLeaderboardResponse = z.output<typeof TelescopeLeaderboardResponseSchema>;

// ── Trends / error-rate (feature 13 — error-rate over longer windows) ──────
// Hourly buckets over a 6h/24h window — a coarser, longer lens than the
// overview's 24 fixed buckets.

export const TelescopeTrendPointSchema = z
	.object({
		/** Bucket start time (ISO). */
		t: z.string(),
		requests: z.number().int().nonnegative(),
		errors: z.number().int().nonnegative(),
		/** errors/requests × 100 (0 when no requests). */
		errorRatePct: z.number().nonnegative(),
	})
	.strict();
export type TelescopeTrendPoint = z.output<typeof TelescopeTrendPointSchema>;

export const TelescopeTrendsQuerySchema = z.object({ range: TelescopeRangeSchema.default("24h") }).strict();
export type TelescopeTrendsQuery = z.output<typeof TelescopeTrendsQuerySchema>;

export const TelescopeTrendsResponseSchema = z
	.object({
		range: TelescopeRangeSchema,
		points: z.array(TelescopeTrendPointSchema).readonly(),
	})
	.strict();
export type TelescopeTrendsResponse = z.output<typeof TelescopeTrendsResponseSchema>;

// ── Leaderboard query (feature 12) ─────────────────────────────────────────

export const TelescopeLeaderboardQuerySchema = z.object({ range: TelescopeRangeSchema.default("1h") }).strict();
export type TelescopeLeaderboardQuery = z.output<typeof TelescopeLeaderboardQuerySchema>;

// ── Logs browser (feature 20 — /telescope/logs) ────────────────────────────
// Console output flattened across requests, correlated back to the request.

export const TelescopeLogRowSchema = z
	.object({
		id: z.string(),
		requestId: z.string(),
		correlationId: z.string(),
		level: TelescopeLogLevelSchema,
		message: z.string(),
		timestamp: z.string(),
		method: z.string().nullable(),
		path: z.string().nullable(),
	})
	.strict();
export type TelescopeLogRow = z.output<typeof TelescopeLogRowSchema>;

export const TelescopeLogsListQuerySchema = TelescopePaginationSchema.extend({
	level: TelescopeLogLevelSchema.optional(),
	q: z.string().optional(),
	correlationId: z.string().optional(),
}).strict();
export type TelescopeLogsListQuery = z.output<typeof TelescopeLogsListQuerySchema>;

export const TelescopeLogsListResponseSchema = z
	.object({
		items: z.array(TelescopeLogRowSchema).readonly(),
		total: z.number().int(),
		page: z.number().int(),
		pageSize: z.number().int(),
	})
	.strict();
export type TelescopeLogsListResponse = z.output<typeof TelescopeLogsListResponseSchema>;

// ── Alerts (feature 18 — threshold alerts) ─────────────────────────────────

export const TelescopeAlertReasonSchema = z.enum(["duration", "error"]);
export type TelescopeAlertReason = z.output<typeof TelescopeAlertReasonSchema>;

/** Triage status for an alert (improvement 5 — ack/snooze). */
export const TelescopeAlertStatusSchema = z.enum(["open", "acknowledged", "snoozed"]);
export type TelescopeAlertStatus = z.output<typeof TelescopeAlertStatusSchema>;

export const TelescopeAlertEntrySchema = z
	.object({
		id: z.string(),
		requestId: z.string(),
		method: z.string(),
		path: z.string(),
		statusCode: z.number().int().nullable(),
		durationMs: z.number().int().nonnegative(),
		reason: TelescopeAlertReasonSchema,
		firedAt: z.string(),
		/** Triage status (improvement 5) — open until acked or snoozed. */
		status: TelescopeAlertStatusSchema.default("open"),
		/** When a snoozed alert becomes open again; null when not snoozed. */
		snoozedUntil: z.string().nullable().default(null),
	})
	.strict();
export type TelescopeAlertEntry = z.output<typeof TelescopeAlertEntrySchema>;

export const TelescopeAlertsResponseSchema = z
	.object({
		items: z.array(TelescopeAlertEntrySchema).readonly(),
	})
	.strict();
export type TelescopeAlertsResponse = z.output<typeof TelescopeAlertsResponseSchema>;

/** Body for `POST /telescope/alerts/:id/snooze` (improvement 5). */
export const TelescopeAlertSnoozeInputSchema = z
	.object({
		/** Snooze window in minutes (default 30). */
		minutes: z.coerce.number().int().positive().max(1440).default(30),
	})
	.strict();
export type TelescopeAlertSnoozeInput = z.output<typeof TelescopeAlertSnoozeInputSchema>;

// ── Request replay (feature 7 — re-send a captured request) ────────────────

export const TelescopeReplayInputSchema = z
	.object({
		/** Named target from `TELESCOPE_REPLAY_TARGETS` (defaults to `local`). */
		target: z.string().default("local"),
	})
	.strict();
export type TelescopeReplayInput = z.output<typeof TelescopeReplayInputSchema>;

export const TelescopeReplayResponseSchema = z
	.object({
		ok: z.boolean(),
		status: z.number().int().nullable(),
		statusText: z.string(),
		durationMs: z.number().int().nonnegative(),
		/** First 500 chars of the replay response body (best-effort). */
		responsePreview: z.string().nullable(),
	})
	.strict();
export type TelescopeReplayResponse = z.output<typeof TelescopeReplayResponseSchema>;

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
