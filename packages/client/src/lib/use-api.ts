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
import { useMemo } from "react";
import { z, type ZodType } from "zod";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

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
export type RefreshResult = "ok" | "expired" | "transient";

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
 * Loose so extra fields (e.g. validation details) don't cause parsing to fail.
 * `error` is the canonical auth code (see `AuthErrorCodeSchema`); the lockout
 * fields are present only on `ACCOUNT_LOCKED` responses.
 */
export const ApiErrorSchema = z
	.object({
		message: z.string(),
		error: z.string().optional(),
		statusCode: z.number().optional(),
		lockedUntil: z.string().optional(),
		remainingSeconds: z.number().optional(),
	})
	.loose();

export interface ApiErrorBody {
	readonly message: string;
	readonly error?: string;
	readonly statusCode?: number;
	readonly lockedUntil?: string;
	readonly remainingSeconds?: number;
}

/**
 * Structured API error thrown by `requestOrThrow`. Unlike a plain `Error`, it
 * preserves the server's `error` code and (for `ACCOUNT_LOCKED`) the lockout
 * payload so callers can map codes to friendly messages and render countdowns.
 */
export class ApiError extends Error implements ApiErrorBody {
	public readonly error?: string;
	public readonly statusCode?: number;
	public readonly lockedUntil?: string;
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

/**
 * Extracts a human-readable message from an error payload.
 * The ResponseInterceptor returns `{ message, statusCode, error? }` — prefer that
 * `message` field when present, otherwise fall back to a generic status message.
 */
function extractErrorMessage(error: unknown, status: number): string {
	if (typeof error === "string" && error.length > 0) {
		return error;
	}
	if (typeof error === "object" && error !== null && "message" in error) {
		const message: unknown = error.message;
		if (typeof message === "string" && message.length > 0) {
			return message;
		}
	}
	return `Request failed (${String(status)})`;
}

type QueryParams = Record<string, string | number | boolean | undefined>;

interface BaseRequestOptions {
	query?: QueryParams;
	headers?: Record<string, string>;
	signal?: AbortSignal;
}

export type RequestOptions<Method extends HttpMethod, Body = unknown> = Method extends "GET" ? BaseRequestOptions : BaseRequestOptions & { body: Body };

export interface ApiSuccess<T> {
	ok: true;
	status: number;
	data: T;
}

export interface ApiFailure {
	ok: false;
	status: number;
	data: null;
	error: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

interface RestProcedureConfig<M extends HttpMethod, Body, Resp> {
	path: string;
	method: M;
	responseSchema?: ZodType<Resp>;
	bodySchema?: M extends "GET" ? never : ZodType<Body>;
	baseOptions?: BaseRequestOptions;
	queryKey?: QueryKey | ((options?: RequestOptions<"GET">) => QueryKey);
}

interface RestQueryProcedure<Resp> {
	queryKey: QueryKey | ((options?: RequestOptions<"GET">) => QueryKey);
	useQuery: (
		options?: RequestOptions<"GET">,
		queryOptions?: Omit<UseQueryOptions<Resp, Error, Resp>, "queryKey" | "queryFn">,
		overrideQueryKey?: QueryKey,
	) => UseQueryResult<Resp>;
	fetch: (options?: RequestOptions<"GET">) => Promise<ApiResponse<Resp>>;
	fetchOrThrow: (options?: RequestOptions<"GET">) => Promise<Resp>;
}

interface RestMutationProcedure<Resp, Body> {
	useMutation: (mutationOptions?: UseMutationOptions<Resp, Error, Body>) => UseMutationResult<Resp, Error, Body>;
	mutate: (body: Body) => Promise<Resp>;
}

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
async function request<T, Body = unknown>(
	baseUrl: string,
	method: HttpMethod,
	path: string,
	options: (BaseRequestOptions & { body?: unknown }) | undefined,
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
			const isJson = res.headers.get("content-type")?.includes("application/json");

			if (!res.ok) {
				const errorData: unknown = isJson ? await res.json() : await res.text();
				return { ok: false, status: res.status, data: null, error: errorData };
			}

			const rawData: unknown = isJson ? await res.json() : null;
			// When a schema is provided, validate the payload. When it isn't, rely on
			// z.custom<T>() (a passthrough schema) to type the raw payload as T without
			// resorting to an `as T` type assertion.
			const data: T = responseSchema ? responseSchema.parse(rawData) : z.custom<T>().parse(rawData);

			return { ok: true, status: res.status, data };
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				return { ok: false, status: 0, data: null, error: "aborted" };
			}
			return { ok: false, status: 0, data: null, error };
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
 * the typed endpoint registry (`authEndpoints.refresh` / `authEndpoints.logout`)
 * so endpoint URLs stay a single source of truth.
 */
export function apiFetch<T = unknown>(baseUrl: string, method: HttpMethod, path: string, options?: BaseRequestOptions & { body?: unknown }): Promise<ApiResponse<T>> {
	return request<T>(baseUrl, method, path, options, undefined, undefined, undefined, undefined);
}

async function requestOrThrow<T, Method extends HttpMethod, Body = unknown>(
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
		// Structured API error body → throw an ApiError so the error code and
		// lockout payload survive for friendly-message mapping / countdowns.
		const parsedBody = ApiErrorSchema.safeParse(res.error);
		if (parsedBody.success) {
			throw new ApiError(parsedBody.data);
		}
		throw new Error(extractErrorMessage(res.error, res.status));
	}

	return res.data;
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

/**
 * Builds a typed REST procedure (query or mutation) from a config.
 *
 * Exposed as a standalone function (rather than inline in the object literal)
 * so it can use function overloads — the conditional return type cannot be
 * expressed with object-literal method overloads.
 */
function createProcedure<M extends HttpMethod, Resp, Body>(
	baseUrl: string,
	onUnauthorized: OnUnauthorized | undefined,
	onRefresh: OnRefresh | undefined,
	config: RestProcedureConfig<M, Body, Resp>,
): M extends "GET" ? RestQueryProcedure<Resp> : RestMutationProcedure<Resp, Body>;

function createProcedure<Resp, Body>(
	baseUrl: string,
	onUnauthorized: OnUnauthorized | undefined,
	onRefresh: OnRefresh | undefined,
	config: RestProcedureConfig<HttpMethod, Body, Resp>,
): RestQueryProcedure<Resp> | RestMutationProcedure<Resp, Body>;

function createProcedure<Resp, Body>(
	baseUrl: string,
	onUnauthorized: OnUnauthorized | undefined,
	onRefresh: OnRefresh | undefined,
	config: RestProcedureConfig<HttpMethod, Body, Resp>,
): RestQueryProcedure<Resp> | RestMutationProcedure<Resp, Body> {
	const { method, path, responseSchema, bodySchema, baseOptions, queryKey } = config;

	const computeQueryKey = (options?: RequestOptions<"GET">, override?: QueryKey): QueryKey => {
		if (override) return override;
		if (typeof queryKey === "function") return queryKey(options);
		if (queryKey) return queryKey;
		return [method, path];
	};

	if (method === "GET") {
		const queryProcedure: RestQueryProcedure<Resp> = {
			queryKey: queryKey ?? [method, path],
			useQuery: (
				options?: RequestOptions<"GET">,
				queryOptions?: Omit<UseQueryOptions<Resp, Error, Resp>, "queryKey" | "queryFn">,
				overrideQueryKey?: QueryKey,
			): UseQueryResult<Resp> => {
				const finalQueryKey = computeQueryKey(options, overrideQueryKey);

				return rqUseQuery<Resp, Error, Resp>({
					queryKey: finalQueryKey,
					queryFn: ({ signal }): Promise<Resp> => {
						const mergedOptions = mergeGetOptions(baseOptions, { ...options, signal });
						return requestOrThrow<Resp, "GET">(baseUrl, "GET", path, mergedOptions, responseSchema, undefined, onUnauthorized, onRefresh);
					},
					...queryOptions,
				});
			},
			fetch: (options?: RequestOptions<"GET">): Promise<ApiResponse<Resp>> => {
				const mergedOptions = mergeGetOptions(baseOptions, options);
				return request<Resp>(baseUrl, "GET", path, mergedOptions, responseSchema, undefined, onUnauthorized, onRefresh);
			},
			fetchOrThrow: (options?: RequestOptions<"GET">): Promise<Resp> => {
				const mergedOptions = mergeGetOptions(baseOptions, options);
				return requestOrThrow<Resp, "GET">(baseUrl, "GET", path, mergedOptions, responseSchema, undefined, onUnauthorized, onRefresh);
			},
		};

		return queryProcedure;
	}

	const mutationProcedure: RestMutationProcedure<Resp, Body> = {
		useMutation: (mutationOptions?: UseMutationOptions<Resp, Error, Body>): UseMutationResult<Resp, Error, Body> =>
			rqUseMutation<Resp, Error, Body>({
				mutationFn: (body: Body): Promise<Resp> => {
					const mergedOptions = mergeMutationOptions(baseOptions, body);

					if (method === "POST") {
						return requestOrThrow<Resp, "POST", Body>(baseUrl, "POST", path, mergedOptions, responseSchema, bodySchema, onUnauthorized, onRefresh);
					} else if (method === "PUT") {
						return requestOrThrow<Resp, "PUT", Body>(baseUrl, "PUT", path, mergedOptions, responseSchema, bodySchema, onUnauthorized, onRefresh);
					} else if (method === "PATCH") {
						return requestOrThrow<Resp, "PATCH", Body>(baseUrl, "PATCH", path, mergedOptions, responseSchema, bodySchema, onUnauthorized, onRefresh);
					} else {
						return requestOrThrow<Resp, "DELETE", Body>(baseUrl, "DELETE", path, mergedOptions, responseSchema, bodySchema, onUnauthorized, onRefresh);
					}
				},
				...mutationOptions,
			}),
		mutate: (body: Body): Promise<Resp> => {
			const mergedOptions = mergeMutationOptions(baseOptions, body);

			if (method === "POST") {
				return requestOrThrow<Resp, "POST", Body>(baseUrl, "POST", path, mergedOptions, responseSchema, bodySchema, onUnauthorized, onRefresh);
			} else if (method === "PUT") {
				return requestOrThrow<Resp, "PUT", Body>(baseUrl, "PUT", path, mergedOptions, responseSchema, bodySchema, onUnauthorized, onRefresh);
			} else if (method === "PATCH") {
				return requestOrThrow<Resp, "PATCH", Body>(baseUrl, "PATCH", path, mergedOptions, responseSchema, bodySchema, onUnauthorized, onRefresh);
			} else {
				return requestOrThrow<Resp, "DELETE", Body>(baseUrl, "DELETE", path, mergedOptions, responseSchema, bodySchema, onUnauthorized, onRefresh);
			}
		},
	};

	return mutationProcedure;
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

	procedure<M extends HttpMethod, Resp, Body = undefined>(
		config: RestProcedureConfig<M, Body, Resp>,
	): M extends "GET" ? RestQueryProcedure<Resp> : RestMutationProcedure<Resp, Body>;
}

export type UseApiReturn = ApiClientRQHooks;

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
export function useApi(baseUrl: string, onUnauthorized: OnUnauthorized, onRefresh: OnRefresh): UseApiReturn {
	return useMemo(() => {
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

			procedure<M extends HttpMethod, Resp, Body = undefined>(
				config: RestProcedureConfig<M, Body, Resp>,
			): M extends "GET" ? RestQueryProcedure<Resp> : RestMutationProcedure<Resp, Body> {
				return createProcedure(baseUrl, onUnauthorized, onRefresh, config);
			},
		};
	}, [baseUrl, onUnauthorized, onRefresh]);
}
