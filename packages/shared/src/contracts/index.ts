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

import { apiRoutes } from "../api-routes";
import { ForgotPasswordSchema, LoginSchema, ResendVerificationSchema, ResetPasswordSchema, SignupSchema } from "../schemas/auth/auth";
import { AdminUserListQuerySchema } from "../schemas/auth/user";
import { EmailLogListQuerySchema } from "../schemas/email/email";
import { BackupCreateInputSchema, BackupRestoreInputSchema, BackupScheduleToggleInputSchema } from "../schemas/domain/backup";
import { TelescopeIdParamSchema, VerifyEmailTokenParamSchema } from "../schemas/domain/param-schemas";
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
// Canonical definitions live in `schemas/api/common.ts` to avoid duplicate
// exports. Re-exported here so consumers importing from `@workspace/shared`
// get them from either path.
import type { DataPrimitive, DataValue } from "../schemas/api/common";
export type { DataPrimitive, DataValue };

/**
 * Every procedure input is either a plain JSON object (path params + query
 * keys / body fields) or `undefined` (no-input procedures like `auth.me`).
 */
export type SerializableInput = Readonly<Record<string, DataValue | undefined>> | undefined;

// ── API versioning ─────────────────────────────────────────────────────────
// The version constants (`API_VERSION`, `apiPath`, `apiDocsPath`, …) live in
// `./versioning` — a dependency-free module — so schemas can import them
// without a circular import (schemas/domain/telescope derives its `ignorePaths`
// from the version prefix). Re-exported here for the public `@workspace/shared`
// surface; anything that only needs the constants can import `./versioning`.
export * from "./versioning";
export { contractPathParam } from "./path-param";

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

/**
 * Convenience: extract the `path` string from a `RouteDef` (static or
 * parameterized) so contracts can reference `apiRoutes` directly.
 */
export type RoutePathOf<T> = T extends { path: string } ? T["path"] : T;

// ── Local helpers ──────────────────────────────────────────────────────────

/** Path-param + body input for the annotation route (the client sends both). */
const RequestAnnotationInputSchema = z
	.object({
		id: TelescopeIdParamSchema,
		...TelescopeAnnotationInputSchema.shape,
	})
	.strict();

/** Path-param + body input for the replay route. */
const ReplayInputSchema = z
	.object({
		id: TelescopeIdParamSchema,
		...TelescopeReplayInputSchema.shape,
	})
	.strict();

/** Path-param + body input for the alert-snooze route. */
const AlertSnoozeInputSchema = z
	.object({
		id: TelescopeIdParamSchema,
		...TelescopeAlertSnoozeInputSchema.shape,
	})
	.strict();

/** Path-param + body input for the exception-status route. */
const ExceptionStatusInputSchema = z
	.object({
		id: TelescopeIdParamSchema,
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

/** Path-param input shared by Telescope routes with an `:id` segment. */
const TelescopeIdInputSchema = z.object({ id: TelescopeIdParamSchema }).strict();

// ── The contract ───────────────────────────────────────────────────────────
// Groups mirror the client router (auth / email / backup / telescope).
// Every leaf is the exact method + path + input the client sends on the wire.
//
// To add a new feature: see docs/ADDING-A-FEATURE.md
//
// NOTE: the version manifest (`GET /version`) is deliberately NOT a
// contract leaf — it is UNVERSIONED (the thing clients use to FIND the
// current version must never move when a major bumps). The client transport
// fetches `${API_BASE_URL}/version` directly and parses it with
// `ApiVersionManifestSchema` from @workspace/shared.

export const apiContract = {
	// ── Authentication & user management ───────────────────────────────
	// Login, signup, token refresh, password reset, email verification,
	// and admin user listing. The admin panel and web app share these.
	auth: {
		/** "Who am I?" — full user record. */
		me: defineContract({ method: "GET", path: apiRoutes.auth.me, input: z.undefined() }),
		/** Basic protected endpoint — proves the access token is valid. */
		sessionStatus: defineContract({ method: "GET", path: apiRoutes.auth.sessionStatus, input: z.undefined() }),
		login: defineContract({ method: "POST", path: apiRoutes.auth.login, input: LoginSchema }),
		/** Admin login — sends `X-Client-Type: admin` for cookie isolation. */
		adminLogin: defineContract({ method: "POST", path: apiRoutes.auth.adminLogin, input: LoginSchema }),
		signup: defineContract({ method: "POST", path: apiRoutes.auth.signup, input: SignupSchema }),
		refresh: defineContract({ method: "POST", path: apiRoutes.auth.refresh, input: EmptyInputSchema }),
		logout: defineContract({ method: "POST", path: apiRoutes.auth.logout, input: EmptyInputSchema }),
		forgotPassword: defineContract({ method: "POST", path: apiRoutes.auth.forgotPassword, input: ForgotPasswordSchema }),
		resetPassword: defineContract({ method: "POST", path: apiRoutes.auth.resetPassword, input: ResetPasswordSchema }),
		resendVerification: defineContract({ method: "POST", path: apiRoutes.auth.resendVerification, input: ResendVerificationSchema }),
		verifyEmail: defineContract({ method: "POST", path: apiRoutes.auth.verifyEmail.path, input: z.object({ token: VerifyEmailTokenParamSchema }).strict() }),
		adminUsers: defineContract({ method: "GET", path: apiRoutes.auth.adminUsers, input: AdminUserListQuerySchema }),
	},

	// ── Email templates & delivery logs ────────────────────────────────
	// Preview email templates (admin-only), send test emails, and
	// query the delivery log. Uses Resend for actual sending.
	email: {
		previewList: defineContract({ method: "GET", path: apiRoutes.email.previewList, input: z.undefined() }),
		/** Preview detail for one template key. */
		previewDetail: defineContract({ method: "GET", path: apiRoutes.email.previewDetail.path, input: z.object({ key: z.string() }).strict() }),
		/** Sends one template to the configured test address. */
		previewSend: defineContract({ method: "POST", path: apiRoutes.email.previewSend.path, input: z.object({ key: z.string() }).strict() }),
		logList: defineContract({ method: "GET", path: apiRoutes.email.logList, input: EmailLogListQuerySchema }),
	},

	// ── Database backup & restore ──────────────────────────────────────
	// pg_dump → gzip → file. Single-job queue, SHA-256 checksums,
	// signed download tokens, scratch-DB verify, and cron scheduling.
	// See docs/backup.md for the full architecture.
	backup: {
		/** Create a backup — async; the job runs in the background (HTTP 202). */
		create: defineContract({ method: "POST", path: apiRoutes.backup.create, input: BackupCreateInputSchema }),
		/** History + operational facts (active flag, retention days). */
		list: defineContract({ method: "GET", path: apiRoutes.backup.list, input: z.undefined() }),
		/** One backup's status/progress — the poll target. */
		status: defineContract({ method: "GET", path: apiRoutes.backup.status.path, input: z.object({ id: z.string().min(1) }).strict() }),
		/** Mints a short-lived signed download token. */
		download: defineContract({ method: "POST", path: apiRoutes.backup.download.path, input: z.object({ id: z.string().min(1) }).strict() }),
		/** Deletes the file + row. */
		remove: defineContract({ method: "DELETE", path: apiRoutes.backup.remove.path, input: z.object({ id: z.string().min(1) }).strict() }),
		/** Excludable tables + form defaults for the create form. */
		options: defineContract({ method: "GET", path: apiRoutes.backup.options, input: z.undefined() }),
		/** Restores the dump into a throwaway scratch DB, confirms, drops it. */
		verify: defineContract({ method: "POST", path: apiRoutes.backup.verify.path, input: z.object({ id: z.string().min(1) }).strict() }),
		/** Restores the dump into a NEW database (never an existing one). */
		restore: defineContract({ method: "POST", path: apiRoutes.backup.restore.path, input: BackupRestoreInputSchema.extend({ id: z.string().min(1) }).strict() }),
		/** Gracefully stops a pending/running backup job. */
		cancel: defineContract({ method: "POST", path: apiRoutes.backup.cancel.path, input: z.object({ id: z.string().min(1) }).strict() }),
		/** Toggle an in-memory backup cron on/off. */
		toggleSchedule: defineContract({ method: "POST", path: apiRoutes.backup.toggleSchedule.path, input: BackupScheduleToggleInputSchema }),
	},

	// ── Telescope observability ────────────────────────────────────────
	// HTTP request tracking, exception logging, SQL query monitoring,
	// email delivery tracking, background job recording, alerts, and
	// SSE live streaming. See docs/telescope.md for the full architecture.
	telescope: {
		overview: defineContract({ method: "GET", path: apiRoutes.telescope.overview, input: TelescopeOverviewQuerySchema }),
		requests: defineContract({ method: "GET", path: apiRoutes.telescope.requests, input: TelescopeRequestListQuerySchema }),
		requestDetail: defineContract({ method: "GET", path: apiRoutes.telescope.requestDetail.path, input: TelescopeIdInputSchema }),
		requestSql: defineContract({ method: "GET", path: apiRoutes.telescope.requestSql.path, input: TelescopeIdInputSchema }),
		compare: defineContract({ method: "GET", path: apiRoutes.telescope.compare, input: TelescopeCompareQuerySchema }),
		sql: defineContract({ method: "GET", path: apiRoutes.telescope.sql, input: TelescopeSqlListQuerySchema }),
		exceptions: defineContract({ method: "GET", path: apiRoutes.telescope.exceptions, input: TelescopeExceptionListQuerySchema }),
		exceptionDetail: defineContract({ method: "GET", path: apiRoutes.telescope.exceptionDetail.path, input: TelescopeIdInputSchema }),
		mail: defineContract({ method: "GET", path: apiRoutes.telescope.mail, input: z.undefined() }),
		jobs: defineContract({ method: "GET", path: apiRoutes.telescope.jobs, input: TelescopeJobsListQuerySchema }),
		jobDetail: defineContract({ method: "GET", path: apiRoutes.telescope.jobDetail.path, input: TelescopeIdInputSchema }),
		schedules: defineContract({ method: "GET", path: apiRoutes.telescope.schedules, input: z.undefined() }),
		leaderboard: defineContract({ method: "GET", path: apiRoutes.telescope.leaderboard, input: TelescopeLeaderboardQuerySchema }),
		trends: defineContract({ method: "GET", path: apiRoutes.telescope.trends, input: TelescopeTrendsQuerySchema }),
		logs: defineContract({ method: "GET", path: apiRoutes.telescope.logs, input: TelescopeLogsListQuerySchema }),
		alerts: defineContract({ method: "GET", path: apiRoutes.telescope.alerts, input: z.undefined() }),
		search: defineContract({ method: "GET", path: apiRoutes.telescope.search, input: TelescopeSearchQuerySchema }),
		users: defineContract({ method: "GET", path: apiRoutes.telescope.users, input: TelescopeUsersQuerySchema }),
		status: defineContract({ method: "GET", path: apiRoutes.telescope.status, input: z.undefined() }),
		webhookDeliveries: defineContract({ method: "GET", path: apiRoutes.telescope.webhookDeliveries, input: z.undefined() }),

		// ── Mutations ─────────────────────────────────────────────────────
		dump: defineContract({ method: "POST", path: apiRoutes.telescope.dump, input: TelescopeDumpInputSchema }),
		setAnnotation: defineContract({ method: "PUT", path: apiRoutes.telescope.setAnnotation.path, input: RequestAnnotationInputSchema }),
		replay: defineContract({ method: "POST", path: apiRoutes.telescope.replay.path, input: ReplayInputSchema }),
		runSchedule: defineContract({ method: "POST", path: apiRoutes.telescope.runSchedule.path, input: z.object({ name: z.string() }).strict() }),
		prune: defineContract({ method: "POST", path: apiRoutes.telescope.prune, input: z.object({ force: ForceFlagSchema }).strict() }),
		clearAll: defineContract({ method: "POST", path: apiRoutes.telescope.clearAll, input: z.undefined() }),
		alertAck: defineContract({ method: "POST", path: apiRoutes.telescope.alertAck.path, input: TelescopeIdInputSchema }),
		alertSnooze: defineContract({ method: "POST", path: apiRoutes.telescope.alertSnooze.path, input: AlertSnoozeInputSchema }),
		setExceptionStatus: defineContract({ method: "PUT", path: apiRoutes.telescope.setExceptionStatus.path, input: ExceptionStatusInputSchema }),
		retryJob: defineContract({ method: "POST", path: apiRoutes.telescope.retryJob.path, input: TelescopeIdInputSchema }),
	},
};

/** The full contract tree — used to derive the client router + API pipes. */
export type ApiContract = typeof apiContract;
