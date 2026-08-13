// ============================================
// lib/endpoints.ts - Typed API endpoint registry
// ============================================
"use client";

import type { QueryKey } from "@tanstack/react-query";
import {
	ApiResponseMetaSchema,
	EmailLogListResponseSchema,
	EmailPreviewListResponseSchema,
	EmailPreviewSchema,
	EmailSendResultSchema,
	ExceptionLogEntrySchema,
	LoginResponseSchema,
	LoginSchema,
	LogoutResponseSchema,
	RefreshResponseSchema,
	SessionStatusSchema,
	SignupResponseSchema,
	SignupSchema,
	TelescopeAlertEntrySchema,
	TelescopeAlertsResponseSchema,
	TelescopeAlertSnoozeInputSchema,
	TelescopeAnnotationInputSchema,
	TelescopeAnnotationSchema,
	TelescopeCompareResponseSchema,
	TelescopeDumpInputSchema,
	TelescopeDumpResponseSchema,
	TelescopeExceptionListResponseSchema,
	TelescopeExceptionStatusInputSchema,
	TelescopeJobLogEntrySchema,
	TelescopeJobsListResponseSchema,
	TelescopeLeaderboardResponseSchema,
	TelescopeLogsListResponseSchema,
	TelescopeMailResponseSchema,
	TelescopeOverviewSchema,
	TelescopeReplayInputSchema,
	TelescopeReplayResponseSchema,
	TelescopeRequestDetailResponseSchema,
	TelescopeRequestListResponseSchema,
	TelescopeRequestSqlResponseSchema,
	TelescopeSchedulesResponseSchema,
	TelescopeSqlListResponseSchema,
	TelescopeTrendsResponseSchema,
	UserResponseSchema,
	type ApiResponseMeta,
	type EmailLogListResponse,
	type EmailPreview,
	type EmailPreviewListResponse,
	type EmailSendResult,
	type ExceptionLogEntry,
	type LoginInput,
	type LoginResponse,
	type LogoutResponse,
	type RefreshResponse,
	type SessionStatus,
	type SignupInput,
	type SignupResponse,
	type TelescopeAlertEntry,
	type TelescopeAlertSnoozeInput,
	type TelescopeAlertsResponse,
	type TelescopeAnnotation,
	type TelescopeAnnotationInput,
	type TelescopeCompareResponse,
	type TelescopeDumpInput,
	type TelescopeDumpResponse,
	type TelescopeExceptionListQuery,
	type TelescopeExceptionListResponse,
	type TelescopeExceptionStatus,
	type TelescopeJobLogEntry,
	type TelescopeJobsListQuery,
	type TelescopeJobsListResponse,
	type TelescopeLeaderboardQuery,
	type TelescopeLeaderboardResponse,
	type TelescopeLogsListQuery,
	type TelescopeLogsListResponse,
	type TelescopeMailResponse,
	type TelescopeOverview,
	type TelescopeRange,
	type TelescopeReplayInput,
	type TelescopeReplayResponse,
	type TelescopeRequestDetailResponse,
	type TelescopeRequestListQuery,
	type TelescopeRequestListResponse,
	type TelescopeRequestSqlResponse,
	type TelescopeSchedulesResponse,
	type TelescopeSqlListQuery,
	type TelescopeSqlListResponse,
	type TelescopeTrendsQuery,
	type TelescopeTrendsResponse,
	type UserResponse,
} from "@workspace/shared";
import { z, type ZodType } from "zod";

// ── Response envelope ──────────────────────────────────────────────────────
// Every endpoint returns the ResponseInterceptor envelope:
// { success: true, data, meta }. We build a typed envelope schema per endpoint
// so the FE knows the exact shape without `any` or `z.unknown`.

interface Envelope<Data> {
	readonly success: true;
	readonly data: Data;
	readonly meta: ApiResponseMeta;
}

// The `Input` type parameter defaults to `unknown` in Zod 4, which keeps the
// input widened so paginated meta schemas (whose input carries extra required
// fields) remain assignable under Zod 4's contravariant `Input` type parameter.
function envelope<Data>(dataSchema: ZodType<Data>, metaSchema: ZodType<ApiResponseMeta> = ApiResponseMetaSchema): ZodType<Envelope<Data>> {
	return z
		.object({
			success: z.literal(true),
			data: dataSchema,
			meta: metaSchema,
		})
		.strict();
}

// ── Procedure config types ─────────────────────────────────────────────────

interface GetProcedure<Resp> {
	readonly path: string;
	readonly method: "GET";
	readonly queryKey: QueryKey;
	readonly responseSchema: ZodType<Resp>;
}

interface PostProcedure<Body, Resp> {
	readonly path: string;
	readonly method: "POST";
	readonly queryKey: QueryKey;
	readonly bodySchema: ZodType<Body>;
	readonly responseSchema: ZodType<Resp>;
	readonly baseOptions?: { readonly headers?: Record<string, string> };
}

interface PutProcedure<Body, Resp> {
	readonly path: string;
	readonly method: "PUT";
	readonly queryKey: QueryKey;
	readonly bodySchema: ZodType<Body>;
	readonly responseSchema: ZodType<Resp>;
	readonly baseOptions?: { readonly headers?: Record<string, string> };
}

// ── Auth endpoints ─────────────────────────────────────────────────────────

export const authEndpoints: {
	readonly me: GetProcedure<Envelope<UserResponse>>;
	readonly sessionStatus: GetProcedure<Envelope<SessionStatus>>;
	readonly login: PostProcedure<LoginInput, Envelope<LoginResponse>>;
	readonly adminLogin: PostProcedure<LoginInput, Envelope<LoginResponse>>;
	readonly signup: PostProcedure<SignupInput, Envelope<SignupResponse>>;
	readonly refresh: PostProcedure<Record<string, never>, Envelope<RefreshResponse>>;
	readonly logout: PostProcedure<Record<string, never>, Envelope<LogoutResponse>>;
} = {
	me: {
		path: "/auth/me",
		method: "GET",
		queryKey: ["auth", "me"],
		responseSchema: envelope(UserResponseSchema),
	},
	// Very basic protected endpoint — proves the access token is valid and
	// answers "who am I + when does my token expire" with no DB work. The
	// admin panel polls it on page mount so every SPA navigation exercises
	// the 401 → silent-refresh → retry flow (see docs/token-refresh.md).
	sessionStatus: {
		path: "/session",
		method: "GET",
		queryKey: ["auth", "session-status"],
		responseSchema: envelope(SessionStatusSchema),
	},
	login: {
		path: "/auth/login",
		method: "POST",
		queryKey: ["auth", "login"],
		bodySchema: LoginSchema,
		responseSchema: envelope(LoginResponseSchema),
	},
	adminLogin: {
		path: "/auth/login",
		method: "POST",
		queryKey: ["auth", "admin-login"],
		bodySchema: LoginSchema,
		responseSchema: envelope(LoginResponseSchema),
		baseOptions: { headers: { "X-Client-Type": "admin" } },
	},
	signup: {
		path: "/auth/signup",
		method: "POST",
		queryKey: ["auth", "signup"],
		bodySchema: SignupSchema,
		responseSchema: envelope(SignupResponseSchema),
	},
	refresh: {
		path: "/auth/refresh",
		method: "POST",
		queryKey: ["auth", "refresh"],
		bodySchema: z.object({}).strict(),
		responseSchema: envelope(RefreshResponseSchema),
	},
	logout: {
		path: "/auth/logout",
		method: "POST",
		queryKey: ["auth", "logout"],
		bodySchema: z.object({}).strict(),
		responseSchema: envelope(LogoutResponseSchema),
	},
};

// ── Email template preview endpoints ───────────────────────────────────────

/**
 * Email-template preview endpoints used by the admin panel's Email Templates
 * page. `previewDetail` is a factory because the route carries a `:key` param
 * — the admin page builds the procedure per selected template.
 */
export const emailEndpoints: {
	readonly previewList: GetProcedure<Envelope<EmailPreviewListResponse>>;
	readonly previewDetail: (key: string) => GetProcedure<Envelope<EmailPreview>>;
	readonly previewSend: (key: string) => PostProcedure<Record<string, never>, Envelope<EmailSendResult>>;
	readonly logList: GetProcedure<Envelope<EmailLogListResponse>>;
} = {
	previewList: {
		path: "/notifications/email-preview",
		method: "GET",
		queryKey: ["email", "preview-list"],
		responseSchema: envelope(EmailPreviewListResponseSchema),
	},
	previewDetail: (key: string): GetProcedure<Envelope<EmailPreview>> => ({
		path: `/notifications/email-preview/${key}`,
		method: "GET",
		queryKey: ["email", "preview-detail", key],
		responseSchema: envelope(EmailPreviewSchema),
	}),
	previewSend: (key: string): PostProcedure<Record<string, never>, Envelope<EmailSendResult>> => ({
		path: `/notifications/email-preview/${key}/send`,
		method: "POST",
		queryKey: ["email", "preview-send", key],
		bodySchema: z.object({}).strict(),
		responseSchema: envelope(EmailSendResultSchema),
	}),
	logList: {
		path: "/notifications/email-log",
		method: "GET",
		queryKey: ["email", "log-list"],
		responseSchema: envelope(EmailLogListResponseSchema),
	},
};

// ── Telescope endpoints (docs/telescope.md §7) ─────────────────────────────
// The read API is admin-gated on the server (AuthGuard + TelescopeAdminGuard)
// and excluded from Swagger. List endpoints take a parsed query object — the
// query doubles as the react-query key slice (structural hashing), so filters
// and pages are distinct cache entries.

// Wrapper schemas for the `{ overview }` / `{ list }` controller envelopes.
const TelescopeOverviewWrapperSchema = z.object({ overview: TelescopeOverviewSchema }).strict();
const TelescopeRequestListWrapperSchema = z.object({ list: TelescopeRequestListResponseSchema }).strict();
const TelescopeSqlListWrapperSchema = z.object({ list: TelescopeSqlListResponseSchema }).strict();
const TelescopeExceptionListWrapperSchema = z.object({ list: TelescopeExceptionListResponseSchema }).strict();

/**
 * Telescope read/write procedures used by the admin panel's Telescope section.
 * `overview`/`requests`/`sql`/`exceptions` are factories over a query object;
 * `mail` reuses the email-log data; `dump` is the `dd()` probe.
 */
export const telescopeEndpoints: {
	readonly overview: (range: TelescopeRange) => GetProcedure<Envelope<{ readonly overview: TelescopeOverview }>>;
	readonly requests: (query: TelescopeRequestListQuery) => GetProcedure<Envelope<{ readonly list: TelescopeRequestListResponse }>>;
	readonly requestDetail: (id: string) => GetProcedure<Envelope<TelescopeRequestDetailResponse>>;
	readonly requestSql: (id: string) => GetProcedure<Envelope<TelescopeRequestSqlResponse>>;
	readonly compare: (a: string, b: string) => GetProcedure<Envelope<TelescopeCompareResponse>>;
	readonly sql: (query: TelescopeSqlListQuery) => GetProcedure<Envelope<{ readonly list: TelescopeSqlListResponse }>>;
	readonly exceptions: (query: TelescopeExceptionListQuery) => GetProcedure<Envelope<{ readonly list: TelescopeExceptionListResponse }>>;
	readonly exceptionDetail: (id: string) => GetProcedure<Envelope<ExceptionLogEntry>>;
	readonly mail: () => GetProcedure<Envelope<TelescopeMailResponse>>;
	readonly dump: PostProcedure<TelescopeDumpInput, Envelope<TelescopeDumpResponse>>;
	// Feature 3 — jobs.
	readonly jobs: (query: TelescopeJobsListQuery) => GetProcedure<Envelope<{ readonly list: TelescopeJobsListResponse }>>;
	readonly jobDetail: (id: string) => GetProcedure<Envelope<TelescopeJobLogEntry>>;
	// Feature 4 — schedules.
	readonly schedules: () => GetProcedure<Envelope<TelescopeSchedulesResponse>>;
	// Feature 12 — leaderboard.
	readonly leaderboard: (query: TelescopeLeaderboardQuery) => GetProcedure<Envelope<TelescopeLeaderboardResponse>>;
	// Feature 13 — trends / error-rate.
	readonly trends: (query: TelescopeTrendsQuery) => GetProcedure<Envelope<TelescopeTrendsResponse>>;
	// Feature 20 — logs browser.
	readonly logs: (query: TelescopeLogsListQuery) => GetProcedure<Envelope<{ readonly list: TelescopeLogsListResponse }>>;
	// Feature 18 — alerts.
	readonly alerts: () => GetProcedure<Envelope<TelescopeAlertsResponse>>;
	// Feature 14 — star/comment a request.
	readonly setAnnotation: (id: string) => PutProcedure<TelescopeAnnotationInput, Envelope<TelescopeAnnotation>>;
	// Feature 7 — replay a captured request.
	readonly replay: (id: string) => PostProcedure<TelescopeReplayInput, Envelope<TelescopeReplayResponse>>;
	// Improvement 5 — acknowledge (resolve) an alert.
	readonly alertAck: (id: string) => PostProcedure<Record<string, never>, Envelope<TelescopeAlertEntry>>;
	// Improvement 5 — snooze an alert for N minutes.
	readonly alertSnooze: (id: string) => PostProcedure<TelescopeAlertSnoozeInput, Envelope<TelescopeAlertEntry>>;
	// Improvement 6 — set the triage status of an exception group.
	readonly setExceptionStatus: (id: string) => PutProcedure<{ readonly status: TelescopeExceptionStatus }, Envelope<ExceptionLogEntry>>;
	// Improvement 17 — re-run a failed job (new entry).
	readonly retryJob: (id: string) => PostProcedure<Record<string, never>, Envelope<TelescopeJobLogEntry>>;
} = {
	overview: (range: TelescopeRange): GetProcedure<Envelope<{ readonly overview: TelescopeOverview }>> => ({
		path: "/telescope/overview",
		method: "GET",
		queryKey: ["telescope", "overview", range],
		responseSchema: envelope(TelescopeOverviewWrapperSchema),
	}),
	requests: (query: TelescopeRequestListQuery): GetProcedure<Envelope<{ readonly list: TelescopeRequestListResponse }>> => ({
		path: "/telescope/requests",
		method: "GET",
		queryKey: ["telescope", "requests", query],
		responseSchema: envelope(TelescopeRequestListWrapperSchema),
	}),
	requestDetail: (id: string): GetProcedure<Envelope<TelescopeRequestDetailResponse>> => ({
		path: `/telescope/requests/${id}`,
		method: "GET",
		queryKey: ["telescope", "request-detail", id],
		responseSchema: envelope(TelescopeRequestDetailResponseSchema),
	}),
	compare: (a: string, b: string): GetProcedure<Envelope<TelescopeCompareResponse>> => ({
		path: `/telescope/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`,
		method: "GET",
		queryKey: ["telescope", "compare", a, b],
		responseSchema: envelope(TelescopeCompareResponseSchema),
	}),
	sql: (query: TelescopeSqlListQuery): GetProcedure<Envelope<{ readonly list: TelescopeSqlListResponse }>> => ({
		path: "/telescope/sql",
		method: "GET",
		queryKey: ["telescope", "sql", query],
		responseSchema: envelope(TelescopeSqlListWrapperSchema),
	}),
	exceptions: (query: TelescopeExceptionListQuery): GetProcedure<Envelope<{ readonly list: TelescopeExceptionListResponse }>> => ({
		path: "/telescope/exceptions",
		method: "GET",
		queryKey: ["telescope", "exceptions", query],
		responseSchema: envelope(TelescopeExceptionListWrapperSchema),
	}),
	exceptionDetail: (id: string): GetProcedure<Envelope<ExceptionLogEntry>> => ({
		path: `/telescope/exceptions/${id}`,
		method: "GET",
		queryKey: ["telescope", "exception-detail", id],
		responseSchema: envelope(ExceptionLogEntrySchema),
	}),
	mail: (): GetProcedure<Envelope<TelescopeMailResponse>> => ({
		path: "/telescope/mail",
		method: "GET",
		queryKey: ["telescope", "mail"],
		responseSchema: envelope(TelescopeMailResponseSchema),
	}),
	dump: {
		path: "/telescope/dump",
		method: "POST",
		queryKey: ["telescope", "dump"],
		bodySchema: TelescopeDumpInputSchema,
		responseSchema: envelope(TelescopeDumpResponseSchema),
	},
	jobs: (query: TelescopeJobsListQuery): GetProcedure<Envelope<{ readonly list: TelescopeJobsListResponse }>> => ({
		path: "/telescope/jobs",
		method: "GET",
		queryKey: ["telescope", "jobs", query],
		responseSchema: envelope(z.object({ list: TelescopeJobsListResponseSchema }).strict()),
	}),
	jobDetail: (id: string): GetProcedure<Envelope<TelescopeJobLogEntry>> => ({
		path: `/telescope/jobs/${id}`,
		method: "GET",
		queryKey: ["telescope", "job-detail", id],
		responseSchema: envelope(TelescopeJobLogEntrySchema),
	}),
	schedules: (): GetProcedure<Envelope<TelescopeSchedulesResponse>> => ({
		path: "/telescope/schedules",
		method: "GET",
		queryKey: ["telescope", "schedules"],
		responseSchema: envelope(TelescopeSchedulesResponseSchema),
	}),
	leaderboard: (query: TelescopeLeaderboardQuery): GetProcedure<Envelope<TelescopeLeaderboardResponse>> => ({
		path: "/telescope/leaderboard",
		method: "GET",
		queryKey: ["telescope", "leaderboard", query],
		responseSchema: envelope(TelescopeLeaderboardResponseSchema),
	}),
	trends: (query: TelescopeTrendsQuery): GetProcedure<Envelope<TelescopeTrendsResponse>> => ({
		path: "/telescope/trends",
		method: "GET",
		queryKey: ["telescope", "trends", query],
		responseSchema: envelope(TelescopeTrendsResponseSchema),
	}),
	logs: (query: TelescopeLogsListQuery): GetProcedure<Envelope<{ readonly list: TelescopeLogsListResponse }>> => ({
		path: "/telescope/logs",
		method: "GET",
		queryKey: ["telescope", "logs", query],
		responseSchema: envelope(z.object({ list: TelescopeLogsListResponseSchema }).strict()),
	}),
	alerts: (): GetProcedure<Envelope<TelescopeAlertsResponse>> => ({
		path: "/telescope/alerts",
		method: "GET",
		queryKey: ["telescope", "alerts"],
		responseSchema: envelope(TelescopeAlertsResponseSchema),
	}),
	setAnnotation: (id: string): PutProcedure<TelescopeAnnotationInput, Envelope<TelescopeAnnotation>> => ({
		path: `/telescope/requests/${id}/annotation`,
		method: "PUT",
		queryKey: ["telescope", "annotation", id],
		bodySchema: TelescopeAnnotationInputSchema,
		responseSchema: envelope(TelescopeAnnotationSchema),
	}),
	replay: (id: string): PostProcedure<TelescopeReplayInput, Envelope<TelescopeReplayResponse>> => ({
		path: `/telescope/replay/${id}`,
		method: "POST",
		queryKey: ["telescope", "replay", id],
		bodySchema: TelescopeReplayInputSchema,
		responseSchema: envelope(TelescopeReplayResponseSchema),
	}),
	requestSql: (id: string): GetProcedure<Envelope<TelescopeRequestSqlResponse>> => ({
		path: `/telescope/requests/${id}/sql`,
		method: "GET",
		queryKey: ["telescope", "request-sql", id],
		responseSchema: envelope(TelescopeRequestSqlResponseSchema),
	}),
	alertAck: (id: string): PostProcedure<Record<string, never>, Envelope<TelescopeAlertEntry>> => ({
		path: `/telescope/alerts/${id}/ack`,
		method: "POST",
		queryKey: ["telescope", "alert-ack", id],
		bodySchema: z.object({}).strict(),
		responseSchema: envelope(TelescopeAlertEntrySchema),
	}),
	alertSnooze: (id: string): PostProcedure<TelescopeAlertSnoozeInput, Envelope<TelescopeAlertEntry>> => ({
		path: `/telescope/alerts/${id}/snooze`,
		method: "POST",
		queryKey: ["telescope", "alert-snooze", id],
		bodySchema: TelescopeAlertSnoozeInputSchema,
		responseSchema: envelope(TelescopeAlertEntrySchema),
	}),
	setExceptionStatus: (id: string): PutProcedure<{ readonly status: TelescopeExceptionStatus }, Envelope<ExceptionLogEntry>> => ({
		path: `/telescope/exceptions/${id}/status`,
		method: "PUT",
		queryKey: ["telescope", "exception-status", id],
		bodySchema: TelescopeExceptionStatusInputSchema,
		responseSchema: envelope(ExceptionLogEntrySchema),
	}),
	retryJob: (id: string): PostProcedure<Record<string, never>, Envelope<TelescopeJobLogEntry>> => ({
		path: `/telescope/jobs/${id}/retry`,
		method: "POST",
		queryKey: ["telescope", "job-retry", id],
		bodySchema: z.object({}).strict(),
		responseSchema: envelope(TelescopeJobLogEntrySchema),
	}),
};
