// ============================================
// contracts/index.ts - The shared API contract
// ============================================
// The single source of truth for every route the client router (`endpoints.ts`
// in @workspace/client) and the NestJS API agree on: HTTP method, path
// template, and the ONE zod input schema both sides use.
//
// - The client router derives its defs from `apiContract` (path/method/input
//   come from here; the client only adds react-query response/key concerns).
// - The API validates at the HTTP boundary with the SAME schemas
//   (`ZodValidationPipe(apiContract.telescope.requests.input)`), so the
//   validation contract can never drift between the two sides.
//
// Inputs are JSON-only (`SerializableInput`), mirroring the client pipeline's
// constraints — no erasure, no casts, full autocomplete on both sides.

import { z, type ZodType } from "zod";

import { ForgotPasswordSchema, LoginSchema, ResendVerificationSchema, ResetPasswordSchema, SignupSchema } from "../schemas/auth/auth";
import { AdminUserListQuerySchema } from "../schemas/auth/user";
import { BackupCreateInputSchema, BackupRestoreInputSchema, BackupScheduleToggleInputSchema } from "../schemas/domain/backup";
import type { ApiVersion } from "./versioning";
import {
	TelescopeAlertSnoozeInputSchema,
	TelescopeAnnotationInputSchema,
	TelescopeCompareQuerySchema,
	TelescopeDumpInputSchema,
	TelescopeExceptionListQuerySchema,
	TelescopeExceptionStatusInputSchema,
	TelescopeJobsListQuerySchema,
	TelescopeLeaderboardQuerySchema,
	TelescopeLogsListQuerySchema,
	TelescopeOverviewQuerySchema,
	TelescopeReplayInputSchema,
	TelescopeRequestListQuerySchema,
	TelescopeSearchQuerySchema,
	TelescopeSqlListQuerySchema,
	TelescopeTrendsQuerySchema,
	TelescopeUsersQuerySchema,
} from "../schemas/domain/telescope";

// ── JSON-safe value types (shared by the contract and the client pipeline) ─

/** A JSON-serializable primitive. */
export type JsonPrimitive = string | number | boolean | null;

/**
 * Any JSON-serializable value. The object branch tolerates `undefined` values
 * so optional object shapes (`{ page?: number }`) satisfy it — `undefined`
 * properties are simply skipped during serialization.
 */
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue | undefined };

/**
 * Every procedure input is either a plain JSON object (path params + query
 * keys / body fields) or `undefined` (no-input procedures like `auth.me`).
 */
export type SerializableInput = Readonly<Record<string, JsonValue | undefined>> | undefined;

// ── API versioning ─────────────────────────────────────────────────────────
// The version constants (`API_VERSION`, `apiPath`, `apiDocsPath`, …) live in
// `./versioning` — a dependency-free module — so schemas can import them
// without a circular import (schemas/domain/telescope derives its `ignorePaths`
// from the version prefix). Re-exported here for the public `@workspace/shared`
// surface; anything that only needs the constants can import `./versioning`.
export * from "./versioning";

// ── Route contract ─────────────────────────────────────────────────────────

export type RestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * One route of the contract: the wire method + path template + the single zod
 * input schema. `M` keeps the literal method (so the client router can tell
 * query defs from mutation defs without any cast), and `Input` is constrained
 * to JSON so the schema is a valid contract input on both sides.
 *
 * `version` defaults to `API_VERSION` at the transport; a leaf can override it
 * (`version: "v2"`) so a single contract describes a v1+v2 migration without
 * forking the whole tree. `deprecatedSince`/`sunsetAt` are metadata for the
 * `Sunset` header and client-side deprecation warnings.
 */
export interface ApiContractDef<Input extends SerializableInput, M extends RestMethod = RestMethod> {
	readonly method: M;
	readonly path: string;
	readonly input: ZodType<Input>;
	readonly version?: ApiVersion;
	readonly deprecatedSince?: string;
	readonly sunsetAt?: string;
}

/** Declares one route in the contract. */
export function defineContract<Input extends SerializableInput, M extends RestMethod>(def: {
	readonly method: M;
	readonly path: string;
	readonly input: ZodType<Input>;
	readonly version?: ApiVersion;
	readonly deprecatedSince?: string;
	readonly sunsetAt?: string;
}): ApiContractDef<Input, M> {
	return def;
}

// ── Local helpers ──────────────────────────────────────────────────────────

/** Path-param + body input for the annotation route (the client sends both). */
const RequestAnnotationInputSchema = z
	.object({
		id: z.string(),
		...TelescopeAnnotationInputSchema.shape,
	})
	.strict();

/** Path-param + body input for the replay route. */
const ReplayInputSchema = z
	.object({
		id: z.string(),
		...TelescopeReplayInputSchema.shape,
	})
	.strict();

/** Path-param + body input for the alert-snooze route. */
const AlertSnoozeInputSchema = z
	.object({
		id: z.string(),
		...TelescopeAlertSnoozeInputSchema.shape,
	})
	.strict();

/** Path-param + body input for the exception-status route. */
const ExceptionStatusInputSchema = z
	.object({
		id: z.string(),
		...TelescopeExceptionStatusInputSchema.shape,
	})
	.strict();

/**
 * `force` rides the QUERY string (`?force=true|false`), so the wire value is
 * a string even though the client input is a boolean. The union accepts both
 * representations so the same schema validates the client's logical input
 * AND the API's wire query — no drift, no cast.
 */
const ForceFlagSchema = z.union([z.boolean(), z.enum(["true", "false"])]);

/** No-input body (refresh/logout send an empty `{}`). */
const EmptyInputSchema = z.object({}).strict();

// ── The contract ───────────────────────────────────────────────────────────
// Groups mirror the client router (auth / email / telescope). Every leaf is
// the exact method + path + input the client sends on the wire.

export const apiContract = {
	// NOTE: the version manifest (`GET /version`) is deliberately NOT a
	// contract leaf — it is UNVERSIONED (the thing clients use to FIND the
	// current version must never move when a major bumps). The client transport
	// fetches `${API_BASE_URL}/version` directly and parses it with
	// `ApiVersionManifestSchema` from @workspace/shared.

	auth: {
		/** "Who am I?" — full user record. */
		me: defineContract({ method: "GET", path: "/auth/me", input: z.undefined() }),
		/** Basic protected endpoint — proves the access token is valid. */
		sessionStatus: defineContract({ method: "GET", path: "/session", input: z.undefined() }),
		login: defineContract({ method: "POST", path: "/auth/login", input: LoginSchema }),
		/** Admin login — sends `X-Client-Type: admin` for cookie isolation. */
		adminLogin: defineContract({ method: "POST", path: "/auth/login", input: LoginSchema }),
		signup: defineContract({ method: "POST", path: "/auth/signup", input: SignupSchema }),
		refresh: defineContract({ method: "POST", path: "/auth/refresh", input: EmptyInputSchema }),
		logout: defineContract({ method: "POST", path: "/auth/logout", input: EmptyInputSchema }),
		forgotPassword: defineContract({ method: "POST", path: "/auth/forgot-password", input: ForgotPasswordSchema }),
		resetPassword: defineContract({ method: "POST", path: "/auth/reset-password", input: ResetPasswordSchema }),
		resendVerification: defineContract({ method: "POST", path: "/auth/resend-verification", input: ResendVerificationSchema }),
		verifyEmail: defineContract({ method: "POST", path: "/auth/verify-email/:token", input: z.object({ token: z.string() }).strict() }),
		adminUsers: defineContract({ method: "GET", path: "/auth/admin/users", input: AdminUserListQuerySchema }),
	},

	// ── Email template preview procedures ─────────────────────────────────
	email: {
		previewList: defineContract({ method: "GET", path: "/notifications/email-preview", input: z.undefined() }),
		/** Preview detail for one template key. */
		previewDetail: defineContract({ method: "GET", path: "/notifications/email-preview/:key", input: z.object({ key: z.string() }).strict() }),
		/** Sends one template to the configured test address. */
		previewSend: defineContract({ method: "POST", path: "/notifications/email-preview/:key/send", input: z.object({ key: z.string() }).strict() }),
		logList: defineContract({ method: "GET", path: "/notifications/email-log", input: z.undefined() }),
	},

	// ── Database backup procedures ───────────────────────────────────────
	backup: {
		/** Create a backup — async; the job runs in the background (HTTP 202). */
		create: defineContract({ method: "POST", path: "/backup", input: BackupCreateInputSchema }),
		/** History + operational facts (active flag, retention days). */
		list: defineContract({ method: "GET", path: "/backup", input: z.undefined() }),
		/** One backup's status/progress — the poll target. */
		status: defineContract({ method: "GET", path: "/backup/:id", input: z.object({ id: z.string().min(1) }).strict() }),
		/** Mints a short-lived signed download token. */
		download: defineContract({ method: "POST", path: "/backup/:id/download", input: z.object({ id: z.string().min(1) }).strict() }),
		/** Deletes the file + row. */
		remove: defineContract({ method: "DELETE", path: "/backup/:id", input: z.object({ id: z.string().min(1) }).strict() }),
		/** Excludable tables + form defaults for the create form. */
		options: defineContract({ method: "GET", path: "/backup/options", input: z.undefined() }),
		/** Restores the dump into a throwaway scratch DB, confirms, drops it. */
		verify: defineContract({ method: "POST", path: "/backup/:id/verify", input: z.object({ id: z.string().min(1) }).strict() }),
		/** Restores the dump into a NEW database (never an existing one). */
		restore: defineContract({ method: "POST", path: "/backup/:id/restore", input: BackupRestoreInputSchema.extend({ id: z.string().min(1) }).strict() }),
		/** Gracefully stops a pending/running backup job. */
		cancel: defineContract({ method: "POST", path: "/backup/:id/cancel", input: z.object({ id: z.string().min(1) }).strict() }),
		/** Toggle an in-memory backup cron on/off. */
		toggleSchedule: defineContract({ method: "POST", path: "/backup/schedules/:id/toggle", input: BackupScheduleToggleInputSchema }),
	},

	// ── Telescope procedures ──────────────────────────────────────────────
	telescope: {
		overview: defineContract({ method: "GET", path: "/telescope/overview", input: TelescopeOverviewQuerySchema }),
		requests: defineContract({ method: "GET", path: "/telescope/requests", input: TelescopeRequestListQuerySchema }),
		requestDetail: defineContract({ method: "GET", path: "/telescope/requests/:id", input: z.object({ id: z.string() }).strict() }),
		requestSql: defineContract({ method: "GET", path: "/telescope/requests/:id/sql", input: z.object({ id: z.string() }).strict() }),
		compare: defineContract({ method: "GET", path: "/telescope/compare", input: TelescopeCompareQuerySchema }),
		sql: defineContract({ method: "GET", path: "/telescope/sql", input: TelescopeSqlListQuerySchema }),
		exceptions: defineContract({ method: "GET", path: "/telescope/exceptions", input: TelescopeExceptionListQuerySchema }),
		exceptionDetail: defineContract({ method: "GET", path: "/telescope/exceptions/:id", input: z.object({ id: z.string() }).strict() }),
		mail: defineContract({ method: "GET", path: "/telescope/mail", input: z.undefined() }),
		jobs: defineContract({ method: "GET", path: "/telescope/jobs", input: TelescopeJobsListQuerySchema }),
		jobDetail: defineContract({ method: "GET", path: "/telescope/jobs/:id", input: z.object({ id: z.string() }).strict() }),
		schedules: defineContract({ method: "GET", path: "/telescope/schedules", input: z.undefined() }),
		leaderboard: defineContract({ method: "GET", path: "/telescope/leaderboard", input: TelescopeLeaderboardQuerySchema }),
		trends: defineContract({ method: "GET", path: "/telescope/trends", input: TelescopeTrendsQuerySchema }),
		logs: defineContract({ method: "GET", path: "/telescope/logs", input: TelescopeLogsListQuerySchema }),
		alerts: defineContract({ method: "GET", path: "/telescope/alerts", input: z.undefined() }),
		search: defineContract({ method: "GET", path: "/telescope/search", input: TelescopeSearchQuerySchema }),
		users: defineContract({ method: "GET", path: "/telescope/users", input: TelescopeUsersQuerySchema }),
		status: defineContract({ method: "GET", path: "/telescope/status", input: z.undefined() }),
		webhookDeliveries: defineContract({ method: "GET", path: "/telescope/webhook-deliveries", input: z.undefined() }),

		// ── Mutations ─────────────────────────────────────────────────────
		dump: defineContract({ method: "POST", path: "/telescope/dump", input: TelescopeDumpInputSchema }),
		setAnnotation: defineContract({ method: "PUT", path: "/telescope/requests/:id/annotation", input: RequestAnnotationInputSchema }),
		replay: defineContract({ method: "POST", path: "/telescope/replay/:id", input: ReplayInputSchema }),
		runSchedule: defineContract({ method: "POST", path: "/telescope/schedules/:name/run", input: z.object({ name: z.string() }).strict() }),
		prune: defineContract({ method: "POST", path: "/telescope/admin/prune", input: z.object({ force: ForceFlagSchema }).strict() }),
		clearAll: defineContract({ method: "POST", path: "/telescope/admin/clear", input: z.undefined() }),
		alertAck: defineContract({ method: "POST", path: "/telescope/alerts/:id/ack", input: z.object({ id: z.string() }).strict() }),
		alertSnooze: defineContract({ method: "POST", path: "/telescope/alerts/:id/snooze", input: AlertSnoozeInputSchema }),
		setExceptionStatus: defineContract({ method: "PUT", path: "/telescope/exceptions/:id/status", input: ExceptionStatusInputSchema }),
		retryJob: defineContract({ method: "POST", path: "/telescope/jobs/:id/retry", input: z.object({ id: z.string() }).strict() }),
	},
} as const;

/** The full contract tree — used to derive the client router + API pipes. */
export type ApiContract = typeof apiContract;
