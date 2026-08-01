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
 * Minimal error body returned by the API on non-2xx responses:
 * `{ message, statusCode, error? }`. Loose so extra fields (e.g. validation
 * details) don't cause parsing to fail.
 */
export const ApiErrorSchema = z
	.object({
		message: z.string(),
	})
	.loose();

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

async function request<T, Method extends HttpMethod, Body = unknown>(
	baseUrl: string,
	method: Method,
	path: string,
	options: RequestOptions<Method, Body> | undefined,
	responseSchema: ZodType<T> | undefined,
	bodySchema: ZodType<Body> | undefined,
	onUnauthorized?: OnUnauthorized,
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

	try {
		const res = await fetch(url, init);
		const isJson = res.headers.get("content-type")?.includes("application/json");

		// If 401 and we have an unauthorized handler, call it
		if (res.status === 401 && onUnauthorized) {
			await onUnauthorized();
			return { ok: false, status: res.status, data: null, error: "Unauthorized" };
		}
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
}

async function requestOrThrow<T, Method extends HttpMethod, Body = unknown>(
	baseUrl: string,
	method: Method,
	path: string,
	options: RequestOptions<Method, Body> | undefined,
	responseSchema: ZodType<T> | undefined,
	bodySchema: ZodType<Body> | undefined,
	onUnauthorized?: OnUnauthorized,
): Promise<T> {
	const res = await request<T, Method, Body>(baseUrl, method, path, options, responseSchema, bodySchema, onUnauthorized);

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
	config: RestProcedureConfig<M, Body, Resp>,
): M extends "GET" ? RestQueryProcedure<Resp> : RestMutationProcedure<Resp, Body>;
function createProcedure<Resp, Body>(
	baseUrl: string,
	onUnauthorized: OnUnauthorized | undefined,
	config: RestProcedureConfig<HttpMethod, Body, Resp>,
): RestQueryProcedure<Resp> | RestMutationProcedure<Resp, Body>;
function createProcedure<Resp, Body>(
	baseUrl: string,
	onUnauthorized: OnUnauthorized | undefined,
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
						return requestOrThrow<Resp, "GET">(baseUrl, "GET", path, mergedOptions, responseSchema, undefined, onUnauthorized);
					},
					...queryOptions,
				});
			},
			fetch: (options?: RequestOptions<"GET">): Promise<ApiResponse<Resp>> => {
				const mergedOptions = mergeGetOptions(baseOptions, options);
				return request<Resp, "GET">(baseUrl, "GET", path, mergedOptions, responseSchema, undefined, onUnauthorized);
			},
			fetchOrThrow: (options?: RequestOptions<"GET">): Promise<Resp> => {
				const mergedOptions = mergeGetOptions(baseOptions, options);
				return requestOrThrow<Resp, "GET">(baseUrl, "GET", path, mergedOptions, responseSchema, undefined, onUnauthorized);
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
						return requestOrThrow<Resp, "POST", Body>(baseUrl, "POST", path, mergedOptions, responseSchema, bodySchema, onUnauthorized);
					} else if (method === "PUT") {
						return requestOrThrow<Resp, "PUT", Body>(baseUrl, "PUT", path, mergedOptions, responseSchema, bodySchema, onUnauthorized);
					} else if (method === "PATCH") {
						return requestOrThrow<Resp, "PATCH", Body>(baseUrl, "PATCH", path, mergedOptions, responseSchema, bodySchema, onUnauthorized);
					} else {
						return requestOrThrow<Resp, "DELETE", Body>(baseUrl, "DELETE", path, mergedOptions, responseSchema, bodySchema, onUnauthorized);
					}
				},
				...mutationOptions,
			}),
		mutate: (body: Body): Promise<Resp> => {
			const mergedOptions = mergeMutationOptions(baseOptions, body);

			if (method === "POST") {
				return requestOrThrow<Resp, "POST", Body>(baseUrl, "POST", path, mergedOptions, responseSchema, bodySchema, onUnauthorized);
			} else if (method === "PUT") {
				return requestOrThrow<Resp, "PUT", Body>(baseUrl, "PUT", path, mergedOptions, responseSchema, bodySchema, onUnauthorized);
			} else if (method === "PATCH") {
				return requestOrThrow<Resp, "PATCH", Body>(baseUrl, "PATCH", path, mergedOptions, responseSchema, bodySchema, onUnauthorized);
			} else {
				return requestOrThrow<Resp, "DELETE", Body>(baseUrl, "DELETE", path, mergedOptions, responseSchema, bodySchema, onUnauthorized);
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
 */
export function useApi(baseUrl: string, onUnauthorized?: OnUnauthorized): UseApiReturn {
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
						return requestOrThrow<T, "GET">(baseUrl, "GET", path, mergedOptions, schema, undefined, onUnauthorized);
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
							return requestOrThrow<T, "POST", Body>(baseUrl, "POST", path, mergedOptions, schema, bodySchema, onUnauthorized);
						} else if (method === "PUT") {
							return requestOrThrow<T, "PUT", Body>(baseUrl, "PUT", path, mergedOptions, schema, bodySchema, onUnauthorized);
						} else if (method === "PATCH") {
							return requestOrThrow<T, "PATCH", Body>(baseUrl, "PATCH", path, mergedOptions, schema, bodySchema, onUnauthorized);
						} else {
							return requestOrThrow<T, "DELETE", Body>(baseUrl, "DELETE", path, mergedOptions, schema, bodySchema, onUnauthorized);
						}
					},
					...mutationOptions,
				});
			},

			procedure<M extends HttpMethod, Resp, Body = undefined>(
				config: RestProcedureConfig<M, Body, Resp>,
			): M extends "GET" ? RestQueryProcedure<Resp> : RestMutationProcedure<Resp, Body> {
				return createProcedure(baseUrl, onUnauthorized, config);
			},
		};
	}, [baseUrl, onUnauthorized]);
}
