// ============================================
// lib/use-api.ts - Cookie-Based Authentication
// ============================================
"use client";

import {
	useQuery as rqUseQuery,
	useMutation as rqUseMutation,
	type QueryKey,
	type UseQueryOptions,
	type UseQueryResult,
	type UseMutationOptions,
	type UseMutationResult,
} from "@tanstack/react-query";
import { EpochMsSchema, type EpochMs, type JsonValue, type SerializableInput } from "@workspace/shared";
import { useMemo } from "react";
import { z, type ZodType } from "zod";

import { apiRouter, resolveRequest, type ApiRouter, type MutationDef, type ProcedureDef, type QueryDef } from "./endpoints";

export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export type HttpMethod = z.output<typeof HttpMethodSchema>;

/**
 * Callback invoked when an API request fails with 401 Unauthorized.
 * Accepts either a synchronous handler or an async one.
 */
export type OnUnauthorized = () => void | Promise<void>;

/**
 * Callback invoked to silently refresh the session when a request returns 401.
 *
 * Implementations should call the refresh endpoint (which rotates the cookie
 * set) and resolve `true` on success, `false` on failure. Callers are
 * responsible for single-flighting concurrent refreshes so the token is only
 * rotated once (rotation invalidates the previous token).
 */
export type OnRefresh = () => Promise<boolean>;

/**
 * Refresh outcome as seen by the 401 pipeline. A refresh attempt can either
 * succeed (`"ok"`), fail because the server said the session is dead
 * (`"expired"`), or fail because the network/API is unreachable
 * (`"transient"`). Only `"ok"` makes the pipeline retry the original request.
 */
export const RefreshResultSchema = z.enum(["ok", "expired", "transient"]);

export type RefreshResult = z.output<typeof RefreshResultSchema>;

/**
 * Wraps a refresh function with a cooldown so a failing API is not hammered.
 *
 * Mirrors the proxy's transient-failure fall-through: when a refresh attempt
 * ends in `"transient"`, subsequent calls within `cooldownMs` short-circuit to
 * `false` (no network call) so a dead API is not spammed on every 401. A
 * successful refresh resets the failure timestamp, so a healthy session never
 * gets throttled.
 *
 * @param refresh  Underlying refresh call (single-flight handled by caller).
 * @param cooldownMs  Failure cooldown window. Defaults to 30_000 (30s).
 * @returns  An `OnRefresh` whose `false` means "do not retry the request".
 */
/**
 * Underlying refresh implementation for `createRefreshCooldown` — returns a
 * `RefreshResult` so the wrapper can distinguish dead sessions from a dead API.
 */
export type RefreshCall = () => Promise<RefreshResult>;

export function createRefreshCooldown(refresh: RefreshCall, cooldownMs = 30_000): OnRefresh {
	let lastTransientFailureAt: number | null = null;

	return async (): Promise<boolean> => {
		if (lastTransientFailureAt !== null && Date.now() - lastTransientFailureAt < cooldownMs) {
			return false;
		}

		const result = await refresh();
		if (result === "transient") {
			lastTransientFailureAt = Date.now();
			return false;
		}
		if (result === "expired") {
			// Session is genuinely dead — allow a fresh attempt after the cooldown
			// without suppressing it here (the caller clears state / redirects).
			lastTransientFailureAt = null;
			return false;
		}
		lastTransientFailureAt = null;
		return true;
	};
}

/**
 * Error body returned by the API on non-2xx responses.
 * `error` is the canonical auth code (see `AuthErrorCodeSchema`); the lockout
 * fields are present only on `ACCOUNT_LOCKED` responses.
 *
 * Not `.loose()` deliberately: zod's default object behavior STRIPS unknown
 * keys (it never fails on them), so extra fields such as validation `details`
 * can't break parsing — and the derived `ApiErrorBody` type stays free of an
 * index signature so `ApiError` can `implements` it.
 *
 * Deliberately NOT derived from shared's `ApiErrorResponseSchema.shape.error`:
 * that is the strict, Swagger-documented envelope nested under
 * `{ success: false, error, meta }`, while this is the raw interceptor body
 * (no wrapper), tolerates unknown keys, and adds the client-only lockout
 * fields. The strictness point is unknown EXTRA keys (e.g. validation
 * `details`/`path`): shared's `.strict()` would reject them, this schema
 * strips them. (Note a class-validator body's `message: string[]` fails the
 * `message: z.string()` check here too — a type mismatch, not a strictness
 * one — and is pre-existing behavior handled by the generic-message fallback.)
 */
export const ApiErrorSchema = z.object({
	message: z.string(),
	error: z.string().optional(),
	statusCode: z.number().optional(),
	lockedUntil: EpochMsSchema.optional(),
	remainingSeconds: z.number().optional(),
});

export type ApiErrorBody = z.output<typeof ApiErrorSchema>;

/**
 * Structured API error thrown by `requestOrThrow`. Unlike a plain `Error`, it
 * preserves the server's `error` code and (for `ACCOUNT_LOCKED`) the lockout
 * payload so callers can map codes to friendly messages and render countdowns.
 */
export class ApiError extends Error implements ApiErrorBody {
	public readonly error?: string;
	public readonly statusCode?: number;
	public readonly lockedUntil?: EpochMs;
	public readonly remainingSeconds?: number;

	public constructor(body: ApiErrorBody) {
		super(body.message);
		this.name = "ApiError";
		this.error = body.error;
		this.statusCode = body.statusCode;
		this.lockedUntil = body.lockedUntil;
		this.remainingSeconds = body.remainingSeconds;
	}
}

/** What a failed request carries: a thrown `Error`, an `ApiError`, or raw text. */
export type ApiErrorPayload = Error | string;

/**
 * Extracts a human-readable message from an error payload.
 * The ResponseInterceptor returns `{ message, statusCode, error? }` — prefer that
 * `message` field when present, otherwise fall back to a generic status message.
 */
function extractErrorMessage(error: Error | string, status: number): string {
	if (typeof error === "string" && error.length > 0) {
		return error;
	}
	if (error instanceof Error && error.message.length > 0) {
		return error.message;
	}
	return `Request failed (${String(status)})`;
}

/**
 * Normalizes a non-2xx response body into `ApiErrorPayload`: JSON error bodies
 * become `ApiError` (preserving `error` code + lockout payload), anything else
 * becomes its raw text (or a generic `Error` for empty bodies).
 */
async function readErrorPayload(response: Response): Promise<ApiErrorPayload> {
	const text: string = await response.text();
	if (text.length === 0) {
		return new Error(`Request failed (${String(response.status)})`);
	}
	try {
		const parsed = ApiErrorSchema.safeParse(JSON.parse(text));
		if (parsed.success) {
			return new ApiError(parsed.data);
		}
	} catch {
		// Not JSON (a plain-text error body) — fall through to raw text.
	}
	return text;
}

type QueryParams = Record<string, string | number | boolean | undefined>;

interface BaseRequestOptions {
	query?: QueryParams;
	headers?: Record<string, string>;
	signal?: AbortSignal;
}

export type RequestOptions<Method extends HttpMethod, Body = undefined> = Method extends "GET" ? BaseRequestOptions : BaseRequestOptions & { body: Body };

// ── Transport envelope ─────────────────────────────────────────────────────
// `ApiSuccess<T>` / `ApiFailure` / `ApiResponse<T>` describe the RAW fetch
// outcome BEFORE the server's `{ success, data, meta }` envelope is unwrapped
// — note `ok` + `status`, not `success` + `meta`. No zod schema exists for
// this shape (it's the client's own request pipeline, never parsed from
// external input) and it is generic over `T`, so it deliberately stays a
// plain type — it is NOT the shared `ApiSuccessResponseSchema` contract.

export interface ApiSuccess<T> {
	ok: true;
	status: number;
	data: T;
}

export interface ApiFailure {
	ok: false;
	status: number;
	data: null;
	error: ApiErrorPayload;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

function buildUrl(baseUrl: string, path: string, query?: QueryParams): string {
	const url = new URL(path, baseUrl);
	if (query) {
		Object.entries(query).forEach(([key, value]) => {
			if (value !== undefined) url.searchParams.set(key, String(value));
		});
	}
	return url.toString();
}

function buildHeaders(baseHeaders: Record<string, string> | undefined): Record<string, string> {
	return {
		Accept: "application/json",
		...baseHeaders,
	};
}

/**
 * Core request executor. The `options` type is deliberately wider than
 * `RequestOptions<Method, Body>` so callers like the auth context's `apiFetch`
 * can omit the body on POST lifecycle calls; `RequestOptions` remains
 * assignable, so this is purely additive.
 */
async function request<T, Body = undefined>(
	baseUrl: string,
	method: HttpMethod,
	path: string,
	options: (BaseRequestOptions & { body?: Body }) | undefined,
	responseSchema: ZodType<T> | undefined,
	bodySchema: ZodType<Body> | undefined,
	onUnauthorized?: OnUnauthorized,
	onRefresh?: OnRefresh,
): Promise<ApiResponse<T>> {
	const url = buildUrl(baseUrl, path, options?.query);
	const headers = buildHeaders(options?.headers);
	const init: RequestInit = {
		method,
		headers,
		signal: options?.signal,
		credentials: "include", // CRITICAL: Send cookies with every request
	};

	if (method !== "GET" && options && "body" in options) {
		if (bodySchema) bodySchema.parse(options.body);
		headers["Content-Type"] = "application/json";
		init.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
	}

	const execute = async (): Promise<ApiResponse<T>> => {
		try {
			const res = await fetch(url, init);
			const isJson = res.headers.get("content-type")?.includes("application/json") ?? false;

			if (!res.ok) {
				const errorData: ApiErrorPayload = await readErrorPayload(res);
				return { ok: false, status: res.status, data: null, error: errorData };
			}

			// When a schema is provided, validate the payload. When it isn't, rely on
			// z.custom<T>() (a passthrough schema) to type the raw payload as T.
			// `JSON.parse` returns `any`, so it flows straight into zod's `unknown`
			// parse parameter — never through a typed variable.
			const text: string = isJson ? await res.text() : "";
			const raw: JsonValue = z.custom<JsonValue>().parse(text.length === 0 ? null : JSON.parse(text));
			const data: T = responseSchema ? responseSchema.parse(raw) : z.custom<T>().parse(raw);

			return { ok: true, status: res.status, data };
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				return { ok: false, status: 0, data: null, error: "aborted" };
			}
			if (error instanceof Error || typeof error === "string") {
				return { ok: false, status: 0, data: null, error };
			}
			return { ok: false, status: 0, data: null, error: new Error(String(error)) };
		}
	};

	// Initial attempt
	let result: ApiResponse<T> = await execute();

	// 401 → try a silent refresh once, then retry the original request.
	// The refresh is single-flighted by the caller (auth.tsx) so concurrent
	// 401s share one refresh call instead of rotating the token repeatedly.
	if (result.status === 401 && onRefresh) {
		const refreshed: boolean = await onRefresh();
		if (refreshed) {
			result = await execute();
		}
	}

	// If we're still unauthorized after a (failed or skipped) refresh, hand off
	// to the unauthorized handler (typically: clear session + redirect to login).
	if (result.status === 401 && onUnauthorized) {
		await onUnauthorized();
		return { ok: false, status: result.status, data: null, error: "Unauthorized" };
	}

	return result;
}

/**
 * Raw API call that bypasses the 401-refresh-unauthorized pipeline.
 *
 * Used by the auth context (`AuthProvider`) for lifecycle calls — refresh and
 * logout — that must NOT re-enter the machinery they drive: routing refresh
 * through `useApi` would recurse on a failed refresh, and the context is what
 * *builds* `useApi`, so it cannot depend on it. Pass the `path`/`method` from
 * the typed router (`apiRouter.auth.refresh` / `apiRouter.auth.logout`) so
 * endpoint URLs stay a single source of truth.
 */
export function apiFetch<T>(baseUrl: string, method: HttpMethod, path: string, options?: BaseRequestOptions & { body?: JsonValue }): Promise<ApiResponse<T>> {
	return request<T, JsonValue>(baseUrl, method, path, options, undefined, undefined, undefined, undefined);
}

async function requestOrThrow<T, Method extends HttpMethod, Body = undefined>(
	baseUrl: string,
	method: Method,
	path: string,
	options: RequestOptions<Method, Body> | undefined,
	responseSchema: ZodType<T> | undefined,
	bodySchema: ZodType<Body> | undefined,
	onUnauthorized?: OnUnauthorized,
	onRefresh?: OnRefresh,
): Promise<T> {
	const res = await request<T, Body>(baseUrl, method, path, options, responseSchema, bodySchema, onUnauthorized, onRefresh);

	if (!res.ok) {
		// Preserve the original Error instance (stack, cause) when present;
		// otherwise synthesize one with the server-provided message.
		if (res.error instanceof Error) {
			throw res.error;
		}
		throw new Error(extractErrorMessage(res.error, res.status));
	}

	return res.data;
}

// ── tRPC-style client procedures (input-first, REST transport) ─────────────

/** A GET procedure on the client — `.useQuery()` / `.fetch()` / `.fetchOrThrow()`. */
export interface ClientQueryProcedure<Input, Resp> {
	/**
	 * Query hook. `input` is the single tRPC-style input: it is zod-validated,
	 * serialized onto the URL (path params + query string), and folded into the
	 * react-query key via the def's `queryKey` builder.
	 */
	useQuery(input: Input, queryOptions?: Omit<UseQueryOptions<Resp, Error, Resp>, "queryKey" | "queryFn">, overrideQueryKey?: QueryKey): UseQueryResult<Resp>;
	/** One-shot fetch returning the raw transport envelope. */
	fetch(input: Input): Promise<ApiResponse<Resp>>;
	/** One-shot fetch that throws on failure. */
	fetchOrThrow(input: Input): Promise<Resp>;
}

/** A mutation procedure on the client — `.useMutation()` / `.mutate()`. */
export interface ClientMutationProcedure<Input, Resp> {
	useMutation(mutationOptions?: UseMutationOptions<Resp, Error, Input>): UseMutationResult<Resp, Error, Input>;
	/** One-shot mutation; the input carries path params + body fields. */
	mutate(input: Input): Promise<Resp>;
}

function createQueryProcedure<Input extends SerializableInput, Resp extends JsonValue>(
	baseUrl: string,
	onUnauthorized: OnUnauthorized | undefined,
	onRefresh: OnRefresh | undefined,
	def: QueryDef<Input, Resp>,
): ClientQueryProcedure<Input, Resp> {
	return {
		useQuery: (input, queryOptions?, overrideQueryKey?): UseQueryResult<Resp> => {
			// Key from the RAW input — the server page computes its prefetch key
			// from the same raw input, so hydration binds even when the schema
			// applies defaults (e.g. `sort: "newest"`). Parsing happens inside
			// the queryFn so a disabled query never validates (compare/search
			// gate on `enabled` with placeholder inputs) and validation errors
			// land in the query's error state instead of crashing the render.
			const key: QueryKey = overrideQueryKey ?? def.queryKey(input);
			return rqUseQuery<Resp, Error, Resp>({
				queryKey: key,
				queryFn: ({ signal }): Promise<Resp> => {
					const parsed: Input = def.inputSchema.parse(input);
					const url: string = resolveRequest(def.path, parsed).url;
					return requestOrThrow<Resp, "GET">(baseUrl, "GET", url, { headers: def.baseOptions?.headers, signal }, def.responseSchema, undefined, onUnauthorized, onRefresh);
				},
				...queryOptions,
			});
		},
		fetch: (input): Promise<ApiResponse<Resp>> => {
			const parsed: Input = def.inputSchema.parse(input);
			const url: string = resolveRequest(def.path, parsed).url;
			return request<Resp>(baseUrl, "GET", url, { headers: def.baseOptions?.headers }, def.responseSchema, undefined, onUnauthorized, onRefresh);
		},
		fetchOrThrow: (input): Promise<Resp> => {
			const parsed: Input = def.inputSchema.parse(input);
			const url: string = resolveRequest(def.path, parsed).url;
			return requestOrThrow<Resp, "GET">(baseUrl, "GET", url, { headers: def.baseOptions?.headers }, def.responseSchema, undefined, onUnauthorized, onRefresh);
		},
	};
}

function createMutationProcedure<Input extends SerializableInput, Resp extends JsonValue>(
	baseUrl: string,
	onUnauthorized: OnUnauthorized | undefined,
	onRefresh: OnRefresh | undefined,
	def: MutationDef<Input, Resp>,
): ClientMutationProcedure<Input, Resp> {
	const run = (input: Input): Promise<Resp> => {
		const parsed: Input = def.inputSchema.parse(input);
		const { url, body } = resolveRequest(def.path, parsed, { method: def.method, toQuery: def.toQuery });
		const finalBody: JsonValue = def.toBody !== undefined ? def.toBody(parsed) : (body ?? {});
		return requestOrThrow<Resp, HttpMethod, JsonValue>(
			baseUrl,
			def.method,
			url,
			{ body: finalBody, headers: def.baseOptions?.headers },
			def.responseSchema,
			undefined,
			onUnauthorized,
			onRefresh,
		);
	};
	return {
		useMutation: (mutationOptions?): UseMutationResult<Resp, Error, Input> => rqUseMutation<Resp, Error, Input>({ mutationFn: run, ...mutationOptions }),
		mutate: run,
	};
}

/**
 * Recursively maps the router tree to client procedures — this is what makes
 * `api.auth.me.useQuery()` / `api.telescope.overview.useQuery({ range })` work.
 */
export type ClientRouterTree<R> = {
	[K in keyof R]: R[K] extends QueryDef<infer Input, infer Resp>
		? ClientQueryProcedure<Input, Resp>
		: R[K] extends MutationDef<infer Input, infer Resp>
			? ClientMutationProcedure<Input, Resp>
			: ClientRouterTree<R[K]>;
};

/** The client-side router: same shape as `apiRouter`, every leaf a procedure. */
export type ClientRouter = ClientRouterTree<ApiRouter>;

/**
 * Builds the client router as a TYPED LITERAL — every leaf is created with a
 * generic call against `apiRouter`'s def, so `Input`/`Resp` flow through
 * inference and autocomplete stays intact. No runtime tree-walk, no casts.
 * The `ClientRouter` return annotation is the drift guard: a missing or
 * mistyped leaf fails the typecheck.
 */
function buildClientRouter(baseUrl: string, onUnauthorized: OnUnauthorized | undefined, onRefresh: OnRefresh | undefined): ClientRouter {
	return {
		auth: {
			me: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.auth.me),
			sessionStatus: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.auth.sessionStatus),
			login: createMutationProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.auth.login),
			adminLogin: createMutationProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.auth.adminLogin),
			signup: createMutationProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.auth.signup),
			refresh: createMutationProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.auth.refresh),
			logout: createMutationProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.auth.logout),
		},
		email: {
			previewList: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.email.previewList),
			previewDetail: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.email.previewDetail),
			previewSend: createMutationProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.email.previewSend),
			logList: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.email.logList),
		},
		telescope: {
			overview: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.overview),
			requests: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.requests),
			requestDetail: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.requestDetail),
			requestSql: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.requestSql),
			compare: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.compare),
			sql: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.sql),
			exceptions: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.exceptions),
			exceptionDetail: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.exceptionDetail),
			mail: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.mail),
			jobs: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.jobs),
			jobDetail: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.jobDetail),
			schedules: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.schedules),
			leaderboard: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.leaderboard),
			trends: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.trends),
			logs: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.logs),
			alerts: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.alerts),
			search: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.search),
			users: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.users),
			status: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.status),
			webhookDeliveries: createQueryProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.webhookDeliveries),

			dump: createMutationProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.dump),
			setAnnotation: createMutationProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.setAnnotation),
			replay: createMutationProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.replay),
			runSchedule: createMutationProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.runSchedule),
			prune: createMutationProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.prune),
			clearAll: createMutationProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.clearAll),
			alertAck: createMutationProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.alertAck),
			alertSnooze: createMutationProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.alertSnooze),
			setExceptionStatus: createMutationProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.setExceptionStatus),
			retryJob: createMutationProcedure(baseUrl, onUnauthorized, onRefresh, apiRouter.telescope.retryJob),
		},
	};
}

function createProcedureForDef<Input extends SerializableInput, Resp extends JsonValue>(
	baseUrl: string,
	onUnauthorized: OnUnauthorized | undefined,
	onRefresh: OnRefresh | undefined,
	def: ProcedureDef<Input, Resp>,
): ClientQueryProcedure<Input, Resp> | ClientMutationProcedure<Input, Resp> {
	if (def.kind === "query") {
		return createQueryProcedure(baseUrl, onUnauthorized, onRefresh, def);
	}
	return createMutationProcedure(baseUrl, onUnauthorized, onRefresh, def);
}

export interface ApiClientRQHooks {
	useQuery<T>(
		queryKey: QueryKey,
		path: string,
		options?: RequestOptions<"GET">,
		queryOptions?: Omit<UseQueryOptions<T, Error, T>, "queryKey" | "queryFn">,
		schema?: ZodType<T>,
	): UseQueryResult<T>;

	useMutation<T, Body>(
		method: Exclude<HttpMethod, "GET">,
		path: string,
		baseOptions?: BaseRequestOptions,
		schema?: ZodType<T>,
		bodySchema?: ZodType<Body>,
		mutationOptions?: UseMutationOptions<T, Error, Body>,
	): UseMutationResult<T, Error, Body>;

	procedure<Input extends SerializableInput, Resp extends JsonValue>(def: QueryDef<Input, Resp>): ClientQueryProcedure<Input, Resp>;
	procedure<Input extends SerializableInput, Resp extends JsonValue>(def: MutationDef<Input, Resp>): ClientMutationProcedure<Input, Resp>;
	procedure<Input extends SerializableInput, Resp extends JsonValue>(def: ProcedureDef<Input, Resp>): ClientQueryProcedure<Input, Resp> | ClientMutationProcedure<Input, Resp>;
}

/** The full client API: low-level hooks + `procedure()` + the tRPC-style router. */
export type ApiClient = ApiClientRQHooks & ClientRouter;

/** @deprecated alias — use `ApiClient`. */
export type UseApiReturn = ApiClient;

/**
 * useApi hook - works with cookie-based authentication
 * No need to pass access token - cookies are sent automatically
 *
 * @param baseUrl - Base URL of the API
 * @param onUnauthorized - Called when a request is still 401 after a refresh
 *                         attempt (typically: clear session + redirect to login).
 *                         Required — wired up by AuthProvider.
 * @param onRefresh - Called on 401 to silently refresh the session. Should be
 *                    single-flighted by the caller. When it resolves `true`,
 *                    the original request is retried once. Required — wired up
 *                    by AuthProvider.
 */
export function useApi(baseUrl: string, onUnauthorized: OnUnauthorized, onRefresh: OnRefresh): ApiClient {
	return useMemo(() => {
		// Overloads mirror `ApiClientRQHooks["procedure"]` exactly (same constrained
		// type params) so the object literal typechecks; the implementation
		// narrows by `kind`.
		function procedure<Input extends SerializableInput, Resp extends JsonValue>(def: QueryDef<Input, Resp>): ClientQueryProcedure<Input, Resp>;
		function procedure<Input extends SerializableInput, Resp extends JsonValue>(def: MutationDef<Input, Resp>): ClientMutationProcedure<Input, Resp>;
		function procedure<Input extends SerializableInput, Resp extends JsonValue>(
			def: ProcedureDef<Input, Resp>,
		): ClientQueryProcedure<Input, Resp> | ClientMutationProcedure<Input, Resp>;
		function procedure<Input extends SerializableInput, Resp extends JsonValue>(
			def: ProcedureDef<Input, Resp>,
		): ClientQueryProcedure<Input, Resp> | ClientMutationProcedure<Input, Resp> {
			return createProcedureForDef(baseUrl, onUnauthorized, onRefresh, def);
		}

		return {
			useQuery<T>(
				queryKey: QueryKey,
				path: string,
				options?: RequestOptions<"GET">,
				queryOptions?: Omit<UseQueryOptions<T, Error, T>, "queryKey" | "queryFn">,
				schema?: ZodType<T>,
			): UseQueryResult<T> {
				return rqUseQuery<T, Error, T>({
					queryKey,
					queryFn: ({ signal }): Promise<T> => {
						const mergedOptions = mergeGetOptions(undefined, { ...options, signal });
						return requestOrThrow<T, "GET">(baseUrl, "GET", path, mergedOptions, schema, undefined, onUnauthorized, onRefresh);
					},
					...queryOptions,
				});
			},

			useMutation<T, Body>(
				method: Exclude<HttpMethod, "GET">,
				path: string,
				baseOptions?: BaseRequestOptions,
				schema?: ZodType<T>,
				bodySchema?: ZodType<Body>,
				mutationOptions?: UseMutationOptions<T, Error, Body>,
			): UseMutationResult<T, Error, Body> {
				return rqUseMutation<T, Error, Body>({
					mutationFn: (body: Body): Promise<T> => {
						const mergedOptions = mergeMutationOptions(baseOptions, body);

						if (method === "POST") {
							return requestOrThrow<T, "POST", Body>(baseUrl, "POST", path, mergedOptions, schema, bodySchema, onUnauthorized, onRefresh);
						} else if (method === "PUT") {
							return requestOrThrow<T, "PUT", Body>(baseUrl, "PUT", path, mergedOptions, schema, bodySchema, onUnauthorized, onRefresh);
						} else if (method === "PATCH") {
							return requestOrThrow<T, "PATCH", Body>(baseUrl, "PATCH", path, mergedOptions, schema, bodySchema, onUnauthorized, onRefresh);
						} else {
							return requestOrThrow<T, "DELETE", Body>(baseUrl, "DELETE", path, mergedOptions, schema, bodySchema, onUnauthorized, onRefresh);
						}
					},
					...mutationOptions,
				});
			},

			procedure,
			...buildClientRouter(baseUrl, onUnauthorized, onRefresh),
		};
	}, [baseUrl, onUnauthorized, onRefresh]);
}

function mergeGetOptions(base: BaseRequestOptions | undefined, additional: RequestOptions<"GET"> | undefined): RequestOptions<"GET"> {
	if (!base && !additional) return {};
	if (!base) return additional ?? {};
	if (!additional) return base;

	return {
		query: { ...base.query, ...additional.query },
		headers: { ...base.headers, ...additional.headers },
		signal: additional.signal ?? base.signal,
	};
}

function mergeMutationOptions<Body>(base: BaseRequestOptions | undefined, body: Body): BaseRequestOptions & { body: Body } {
	return {
		...base,
		body,
	};
}
