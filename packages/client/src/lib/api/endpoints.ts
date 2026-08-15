// ============================================
// lib/endpoints.ts - Typed API router (tRPC-flavoured, REST under the hood)
// ============================================
// Pure module (zod schemas + plain procedure definitions — no hooks, no
// browser APIs), deliberately NOT marked "use client": the same router is used
// by client pages for data fetching (useApi builds a client router from it)
// AND by server components for SSR prefetching (server-api.ts builds a caller
// from it), so the definitions must be callable on both sides.
//
// The model is tRPC-like: every leaf is a procedure with a SINGLE typed input
// (zod-validated) and a typed response. "But not exactly tRPC": the
// transport is plain REST — the input maps onto a URL (path params + query
// string for GET, path params + JSON body for mutations) instead of a
// procedure-call envelope. `resolveRequest` is the single serializer shared
// by the client transport and the server prefetch pipeline.
//
// The route contract (method + path + input schema) lives in
// `@workspace/shared` (`apiContract`) — this module derives every def from it,
// so the client router and the API's boundary validation can never drift.
// Only the client-side concerns stay here: the response envelope schema, the
// react-query key, and the serialization knobs (`toQuery` / `toBody`).
//
// The input/output type parameters are CONSTRAINED (`SerializableInput` /
// `JsonValue`) so the shared pipeline (dedupe map, observable, spec closures)
// can be typed end-to-end with generics — no type erasure, no `unknown`,
// no casts anywhere.

import type { QueryKey } from "@tanstack/react-query";
import {
	apiContract,
	EmailLogListResponseSchema,
	EmailPreviewListResponseSchema,
	EmailPreviewSchema,
	EmailSendResultSchema,
	ExceptionLogEntrySchema,
	LoginResponseSchema,
	LogoutResponseSchema,
	RefreshResponseSchema,
	SessionStatusSchema,
	SignupResponseSchema,
	TelescopeAlertEntrySchema,
	TelescopeAlertsResponseSchema,
	TelescopeAnnotationSchema,
	TelescopeCompareResponseSchema,
	TelescopeDumpResponseSchema,
	TelescopeExceptionListResponseSchema,
	TelescopeJobLogEntrySchema,
	TelescopeJobsListResponseSchema,
	TelescopeLeaderboardResponseSchema,
	TelescopeLogsListResponseSchema,
	TelescopeMailResponseSchema,
	TelescopeOverviewSchema,
	TelescopeReplayResponseSchema,
	TelescopeRequestDetailResponseSchema,
	TelescopeRequestListResponseSchema,
	TelescopeRequestSqlResponseSchema,
	TelescopeScheduleLogSchema,
	TelescopeSchedulesResponseSchema,
	TelescopeSearchResponseSchema,
	TelescopeSqlListResponseSchema,
	TelescopeStatusSchema,
	TelescopeTrendsResponseSchema,
	TelescopeUsersResponseSchema,
	TelescopeWebhookDeliveriesResponseSchema,
	UserResponseSchema,
	ApiResponseMetaSchema,
	type ApiContractDef,
	type ApiResponseMeta,
	type JsonValue,
	type RestMethod,
	type SerializableInput,
} from "@workspace/shared";
import { z, type ZodType } from "zod";

// ── Response envelope ──────────────────────────────────────────────────────
// Every endpoint returns the ResponseInterceptor envelope:
// { success: true, data, meta }. We build a typed envelope schema per endpoint
// so the FE knows the exact shape without `any` or `z.unknown`.

/**
 * The envelope is an interface WITH an index signature: the index signature is
 * what makes `Envelope<Data> extends JsonValue` provable for the defs' `Resp`
 * constraint (interfaces only get index-signature assignability when they
 * declare one), while staying a plain interface per the lint rules.
 */
export interface Envelope<Data extends JsonValue> {
	readonly success: true;
	readonly data: Data;
	readonly meta: ApiResponseMeta;
	readonly [key: string]: JsonValue | undefined;
}

function envelope<Data extends JsonValue>(dataSchema: ZodType<Data>, metaSchema: ZodType<ApiResponseMeta> = ApiResponseMetaSchema): ZodType<Envelope<Data>> {
	return z
		.object({
			success: z.literal(true),
			data: dataSchema,
			meta: metaSchema,
		})
		.strict();
}

// ── Definition model (input-first, tRPC-style) ────────────────────────────

/** A GET procedure: input → path params + query string, response → typed payload. */
export interface QueryDef<Input extends SerializableInput, Resp extends JsonValue> {
	readonly kind: "query";
	readonly method: "GET";
	/** Path template; `:name` segments are filled from the input. */
	readonly path: string;
	/** Single typed input, validated before every call (tRPC-style). */
	readonly inputSchema: ZodType<Input>;
	readonly responseSchema: ZodType<Resp>;
	/** Derives the react-query key from the (parsed) input — server and client MUST agree. */
	readonly queryKey: (input: Input) => QueryKey;
	readonly baseOptions?: { readonly headers?: Record<string, string> };
}

/** A POST/PUT/PATCH/DELETE procedure: input → path params + JSON body, response → typed payload. */
export interface MutationDef<Input extends SerializableInput, Resp extends JsonValue> {
	readonly kind: "mutation";
	readonly method: Exclude<RestMethod, "GET">;
	readonly path: string;
	readonly inputSchema: ZodType<Input>;
	readonly responseSchema: ZodType<Resp>;
	readonly queryKey: (input: Input) => QueryKey;
	readonly baseOptions?: { readonly headers?: Record<string, string> };
	/**
	 * Maps the input to the request body. Default: every input key not consumed
	 * by a `:param` segment or listed in `toQuery`.
	 */
	readonly toBody?: (input: Input) => JsonValue;
	/** Input keys routed to the QUERY string instead of the body (e.g. `prune({ force })`). */
	readonly toQuery?: readonly string[];
}

export type ProcedureDef<Input extends SerializableInput, Resp extends JsonValue> = QueryDef<Input, Resp> | MutationDef<Input, Resp>;

/**
 * Declares a GET procedure from its shared contract leaf. The contract owns
 * method + path + input; this layer adds the response envelope + query key.
 */
export function defineQuery<Input extends SerializableInput, Resp extends JsonValue>(
	contract: ApiContractDef<Input, "GET">,
	opts: {
		readonly response: ZodType<Resp>;
		readonly queryKey: (input: Input) => QueryKey;
		readonly baseOptions?: { readonly headers?: Record<string, string> };
	},
): QueryDef<Input, Resp> {
	return {
		kind: "query",
		method: "GET",
		path: contract.path,
		inputSchema: contract.input,
		responseSchema: opts.response,
		queryKey: opts.queryKey,
		baseOptions: opts.baseOptions,
	};
}

/**
 * Declares a POST (or PUT/PATCH/DELETE) procedure from its shared contract
 * leaf. `toQuery` routes input keys to the query string instead of the body.
 */
export function defineMutation<Input extends SerializableInput, Resp extends JsonValue, M extends Exclude<RestMethod, "GET">>(
	contract: ApiContractDef<Input, M>,
	opts: {
		readonly response: ZodType<Resp>;
		readonly queryKey: (input: Input) => QueryKey;
		readonly baseOptions?: { readonly headers?: Record<string, string> };
		readonly toBody?: (input: Input) => JsonValue;
		readonly toQuery?: readonly string[];
	},
): MutationDef<Input, Resp> {
	return {
		kind: "mutation",
		method: contract.method,
		path: contract.path,
		inputSchema: contract.input,
		responseSchema: opts.response,
		queryKey: opts.queryKey,
		baseOptions: opts.baseOptions,
		toBody: opts.toBody,
		toQuery: opts.toQuery,
	};
}

// ── REST serialization (shared by client + server) ─────────────────────────

const PARAM_PATTERN = /:([A-Za-z0-9_]+)/g;

/** Result of serializing an input onto a path template. */
export interface ResolvedRequest {
	readonly url: string;
	/** Present for mutations (defaults to `{}` when the input has no body fields). */
	readonly body?: JsonValue;
}

/**
 * The single input → REST mapping. `:param` segments consume matching input
 * keys into the path; for GET the remaining keys become the query string; for
 * mutations the remaining keys become the JSON body (except `toQuery` keys,
 * which go to the query string instead). `undefined` values are skipped.
 *
 * The `Input` constraint is what keeps this cast-free: a `SerializableInput`
 * is indexable by any key, so no `Record` re-typing is needed.
 */
export function resolveRequest(path: string, input: SerializableInput, options?: { readonly method?: RestMethod; readonly toQuery?: readonly string[] }): ResolvedRequest {
	const record: Readonly<Record<string, JsonValue | undefined>> = input ?? {};
	const method: RestMethod = options?.method ?? "GET";
	const paramNames: readonly string[] = [...path.matchAll(PARAM_PATTERN)].map((match) => match[1] ?? "");

	const consumed = new Set<string>(paramNames);
	for (const key of options?.toQuery ?? []) consumed.add(key);

	let url = path;
	for (const param of paramNames) {
		url = url.replace(`:${param}`, encodeURIComponent(stringifyQueryValue(record[param])));
	}

	// Leftover keys → query string (GET) or body (mutations); `undefined` values are dropped.
	const leftover: readonly { readonly key: string; readonly value: JsonValue }[] = Object.keys(record).flatMap((key) => {
		const value: JsonValue | undefined = record[key];
		if (consumed.has(key) || value === undefined) return [];
		return [{ key, value }];
	});

	if (method === "GET") {
		if (leftover.length > 0) {
			const search = new URLSearchParams();
			for (const { key, value } of leftover) search.set(key, stringifyQueryValue(value));
			const qs = search.toString();
			url = `${url}${url.includes("?") ? "&" : "?"}${qs}`;
		}
		return { url };
	}

	// Mutations: `toQuery` keys ride the query string, everything else is the body.
	const toQueryEntries: readonly { readonly key: string; readonly value: JsonValue }[] = (options?.toQuery ?? []).flatMap((key) => {
		const value: JsonValue | undefined = record[key];
		if (value === undefined) return [];
		return [{ key, value }];
	});
	if (toQueryEntries.length > 0) {
		const search = new URLSearchParams();
		for (const { key, value } of toQueryEntries) search.set(key, stringifyQueryValue(value));
		const qs = search.toString();
		url = `${url}${url.includes("?") ? "&" : "?"}${qs}`;
	}

	const body: Record<string, JsonValue> = {};
	for (const { key, value } of leftover) body[key] = value;
	return { url, body };
}

/** Serializes a query value without tripping no-base-to-string on arbitrary values. */
function stringifyQueryValue(value: JsonValue | undefined): string {
	if (value === undefined) return "";
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (value === null) return "null";
	// Non-primitive values are normalized to their JSON form (schemas only
	// allow primitives on query strings, so this is defensive only).
	return JSON.stringify(value);
}

// ── The router ─────────────────────────────────────────────────────────────
// Every leaf derives path/method/input from `apiContract` (shared) and only
// adds the client-side envelope + query key. Adding a route = adding one
// contract leaf in `@workspace/shared` + one def here + one pipe in the API
// controller — a missing leaf is a compile error on the client and a 400 on
// the API side.

export const apiRouter = {
	auth: {
		/** "Who am I?" — full user record. */
		me: defineQuery(apiContract.auth.me, {
			response: envelope(UserResponseSchema),
			queryKey: () => ["auth", "me"],
		}),
		/** Very basic protected endpoint — proves the access token is valid and answers "who am I + when does my token expire" with no DB work. */
		sessionStatus: defineQuery(apiContract.auth.sessionStatus, {
			response: envelope(SessionStatusSchema),
			queryKey: () => ["auth", "session-status"],
		}),
		login: defineMutation(apiContract.auth.login, {
			response: envelope(LoginResponseSchema),
			queryKey: () => ["auth", "login"],
		}),
		/** Admin login — sends `X-Client-Type: admin` for cookie isolation. */
		adminLogin: defineMutation(apiContract.auth.adminLogin, {
			response: envelope(LoginResponseSchema),
			queryKey: () => ["auth", "admin-login"],
			baseOptions: { headers: { "X-Client-Type": "admin" } },
		}),
		signup: defineMutation(apiContract.auth.signup, {
			response: envelope(SignupResponseSchema),
			queryKey: () => ["auth", "signup"],
		}),
		refresh: defineMutation(apiContract.auth.refresh, {
			response: envelope(RefreshResponseSchema),
			queryKey: () => ["auth", "refresh"],
		}),
		logout: defineMutation(apiContract.auth.logout, {
			response: envelope(LogoutResponseSchema),
			queryKey: () => ["auth", "logout"],
		}),
	},

	// ── Email template preview procedures ─────────────────────────────────────
	email: {
		previewList: defineQuery(apiContract.email.previewList, {
			response: envelope(EmailPreviewListResponseSchema),
			queryKey: () => ["email", "preview-list"],
		}),
		/** Preview detail for one template key. */
		previewDetail: defineQuery(apiContract.email.previewDetail, {
			response: envelope(EmailPreviewSchema),
			queryKey: ({ key }) => ["email", "preview-detail", key],
		}),
		/** Sends one template to the configured test address. */
		previewSend: defineMutation(apiContract.email.previewSend, {
			response: envelope(EmailSendResultSchema),
			queryKey: ({ key }) => ["email", "preview-send", key],
		}),
		logList: defineQuery(apiContract.email.logList, {
			response: envelope(EmailLogListResponseSchema),
			queryKey: () => ["email", "log-list"],
		}),
	},

	// ── Telescope procedures (docs/telescope.md §7) ──────────────────────────
	telescope: {
		overview: defineQuery(apiContract.telescope.overview, {
			response: envelope(z.object({ overview: TelescopeOverviewSchema }).strict()),
			queryKey: ({ range }) => ["telescope", "overview", range],
		}),
		requests: defineQuery(apiContract.telescope.requests, {
			response: envelope(z.object({ list: TelescopeRequestListResponseSchema }).strict()),
			queryKey: (query) => ["telescope", "requests", query],
		}),
		requestDetail: defineQuery(apiContract.telescope.requestDetail, {
			response: envelope(TelescopeRequestDetailResponseSchema),
			queryKey: ({ id }) => ["telescope", "request-detail", id],
		}),
		requestSql: defineQuery(apiContract.telescope.requestSql, {
			response: envelope(TelescopeRequestSqlResponseSchema),
			queryKey: ({ id }) => ["telescope", "request-sql", id],
		}),
		compare: defineQuery(apiContract.telescope.compare, {
			response: envelope(TelescopeCompareResponseSchema),
			queryKey: ({ a, b }) => ["telescope", "compare", a, b],
		}),
		sql: defineQuery(apiContract.telescope.sql, {
			response: envelope(z.object({ list: TelescopeSqlListResponseSchema }).strict()),
			queryKey: (query) => ["telescope", "sql", query],
		}),
		exceptions: defineQuery(apiContract.telescope.exceptions, {
			response: envelope(z.object({ list: TelescopeExceptionListResponseSchema }).strict()),
			queryKey: (query) => ["telescope", "exceptions", query],
		}),
		exceptionDetail: defineQuery(apiContract.telescope.exceptionDetail, {
			response: envelope(ExceptionLogEntrySchema),
			queryKey: ({ id }) => ["telescope", "exception-detail", id],
		}),
		mail: defineQuery(apiContract.telescope.mail, {
			response: envelope(TelescopeMailResponseSchema),
			queryKey: () => ["telescope", "mail"],
		}),
		jobs: defineQuery(apiContract.telescope.jobs, {
			response: envelope(z.object({ list: TelescopeJobsListResponseSchema }).strict()),
			queryKey: (query) => ["telescope", "jobs", query],
		}),
		jobDetail: defineQuery(apiContract.telescope.jobDetail, {
			response: envelope(TelescopeJobLogEntrySchema),
			queryKey: ({ id }) => ["telescope", "job-detail", id],
		}),
		schedules: defineQuery(apiContract.telescope.schedules, {
			response: envelope(TelescopeSchedulesResponseSchema),
			queryKey: () => ["telescope", "schedules"],
		}),
		leaderboard: defineQuery(apiContract.telescope.leaderboard, {
			response: envelope(TelescopeLeaderboardResponseSchema),
			queryKey: (query) => ["telescope", "leaderboard", query],
		}),
		trends: defineQuery(apiContract.telescope.trends, {
			response: envelope(TelescopeTrendsResponseSchema),
			queryKey: (query) => ["telescope", "trends", query],
		}),
		logs: defineQuery(apiContract.telescope.logs, {
			response: envelope(z.object({ list: TelescopeLogsListResponseSchema }).strict()),
			queryKey: (query) => ["telescope", "logs", query],
		}),
		alerts: defineQuery(apiContract.telescope.alerts, {
			response: envelope(TelescopeAlertsResponseSchema),
			queryKey: () => ["telescope", "alerts"],
		}),
		search: defineQuery(apiContract.telescope.search, {
			response: envelope(TelescopeSearchResponseSchema),
			queryKey: (query) => ["telescope", "search", query],
		}),
		users: defineQuery(apiContract.telescope.users, {
			response: envelope(z.object({ list: TelescopeUsersResponseSchema }).strict()),
			queryKey: (query) => ["telescope", "users", query],
		}),
		status: defineQuery(apiContract.telescope.status, {
			response: envelope(TelescopeStatusSchema),
			queryKey: () => ["telescope", "status"],
		}),
		webhookDeliveries: defineQuery(apiContract.telescope.webhookDeliveries, {
			response: envelope(TelescopeWebhookDeliveriesResponseSchema),
			queryKey: () => ["telescope", "webhook-deliveries"],
		}),

		// ── Mutations ─────────────────────────────────────────────────────────
		dump: defineMutation(apiContract.telescope.dump, {
			response: envelope(TelescopeDumpResponseSchema),
			queryKey: () => ["telescope", "dump"],
		}),
		setAnnotation: defineMutation(apiContract.telescope.setAnnotation, {
			response: envelope(TelescopeAnnotationSchema),
			queryKey: ({ id }) => ["telescope", "annotation", id],
		}),
		replay: defineMutation(apiContract.telescope.replay, {
			response: envelope(TelescopeReplayResponseSchema),
			queryKey: ({ id }) => ["telescope", "replay", id],
		}),
		runSchedule: defineMutation(apiContract.telescope.runSchedule, {
			response: envelope(TelescopeScheduleLogSchema),
			queryKey: ({ name }) => ["telescope", "schedule-run", name],
		}),
		prune: defineMutation(apiContract.telescope.prune, {
			toQuery: ["force"],
			response: envelope(z.object({ removed: z.number().int() }).strict()),
			queryKey: ({ force }) => ["telescope", "prune", force],
		}),
		clearAll: defineMutation(apiContract.telescope.clearAll, {
			response: envelope(z.object({ cleared: z.literal(true) }).strict()),
			queryKey: () => ["telescope", "clear-all"],
		}),
		alertAck: defineMutation(apiContract.telescope.alertAck, {
			response: envelope(TelescopeAlertEntrySchema),
			queryKey: ({ id }) => ["telescope", "alert-ack", id],
		}),
		alertSnooze: defineMutation(apiContract.telescope.alertSnooze, {
			response: envelope(TelescopeAlertEntrySchema),
			queryKey: ({ id }) => ["telescope", "alert-snooze", id],
		}),
		setExceptionStatus: defineMutation(apiContract.telescope.setExceptionStatus, {
			response: envelope(ExceptionLogEntrySchema),
			queryKey: ({ id }) => ["telescope", "exception-status", id],
		}),
		retryJob: defineMutation(apiContract.telescope.retryJob, {
			response: envelope(TelescopeJobLogEntrySchema),
			queryKey: ({ id }) => ["telescope", "job-retry", id],
		}),
	},
} as const;

/** The full router tree — used to derive the client router + server caller types. */
export type ApiRouter = typeof apiRouter;
