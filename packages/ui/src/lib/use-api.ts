// ============================================
// lib/use-api.ts - Cookie-Based Authentication
// ============================================
"use client";

import { useMemo } from "react";
import {
	useQuery as rqUseQuery,
	useMutation as rqUseMutation,
	type QueryKey,
	type UseQueryOptions,
	type UseQueryResult,
	type UseMutationOptions,
	type UseMutationResult,
} from "@tanstack/react-query";
import type { ZodType } from "zod";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type QueryParams = Record<string, string | number | boolean | undefined>;

interface BaseRequestOptions {
	query?: QueryParams;
	headers?: Record<string, string>;
	signal?: AbortSignal;
}

export type RequestOptions<Method extends HttpMethod, Body = unknown> = Method extends "GET" ? BaseRequestOptions : BaseRequestOptions & { body: Body };

export type ApiSuccess<T> = {
	ok: true;
	status: number;
	data: T;
};

export type ApiFailure = {
	ok: false;
	status: number;
	data: null;
	error: unknown;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

type RestProcedureConfig<M extends HttpMethod, Body, Resp> = {
	path: string;
	method: M;
	responseSchema?: ZodType<Resp>;
	bodySchema?: M extends "GET" ? never : ZodType<Body>;
	baseOptions?: BaseRequestOptions;
	queryKey?: QueryKey | ((options?: RequestOptions<"GET">) => QueryKey);
};

type RestQueryProcedure<Resp> = {
	queryKey: QueryKey | ((options?: RequestOptions<"GET">) => QueryKey);
	useQuery: (
		options?: RequestOptions<"GET">,
		queryOptions?: Omit<UseQueryOptions<Resp, Error, Resp, QueryKey>, "queryKey" | "queryFn">,
		overrideQueryKey?: QueryKey,
	) => UseQueryResult<Resp, Error>;
	fetch: (options?: RequestOptions<"GET">) => Promise<ApiResponse<Resp>>;
	fetchOrThrow: (options?: RequestOptions<"GET">) => Promise<Resp>;
};

type RestMutationProcedure<Resp, Body> = {
	useMutation: (mutationOptions?: UseMutationOptions<Resp, Error, Body>) => UseMutationResult<Resp, Error, Body>;
	mutate: (body: Body) => Promise<Resp>;
};

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
	onUnauthorized?: () => Promise<void>,
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
			const errorData = isJson ? await res.json() : await res.text();
			return { ok: false, status: res.status, data: null, error: errorData };
		}

		const rawData = isJson ? await res.json() : null;
		const data = responseSchema ? responseSchema.parse(rawData) : (rawData as T);

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
	onUnauthorized?: () => Promise<void>,
): Promise<T> {
	const res = await request<T, Method, Body>(baseUrl, method, path, options, responseSchema, bodySchema, onUnauthorized);

	if (!res.ok) throw res.error ?? new Error(`Request failed (${res.status})`);

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

export interface ApiClientRQHooks {
	useQuery<T>(
		queryKey: QueryKey,
		path: string,
		options?: RequestOptions<"GET">,
		queryOptions?: Omit<UseQueryOptions<T, Error, T, QueryKey>, "queryKey" | "queryFn">,
		schema?: ZodType<T>,
	): UseQueryResult<T, Error>;

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
export function useApi(baseUrl: string, onUnauthorized?: () => Promise<void>): UseApiReturn {
	return useMemo(() => {
		return {
			useQuery<T>(
				queryKey: QueryKey,
				path: string,
				options?: RequestOptions<"GET">,
				queryOptions?: Omit<UseQueryOptions<T, Error, T, QueryKey>, "queryKey" | "queryFn">,
				schema?: ZodType<T>,
			): UseQueryResult<T, Error> {
				return rqUseQuery<T, Error, T, QueryKey>({
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
							queryOptions?: Omit<UseQueryOptions<Resp, Error, Resp, QueryKey>, "queryKey" | "queryFn">,
							overrideQueryKey?: QueryKey,
						): UseQueryResult<Resp, Error> => {
							const finalQueryKey = computeQueryKey(options, overrideQueryKey);

							return rqUseQuery<Resp, Error, Resp, QueryKey>({
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

					return queryProcedure as M extends "GET" ? RestQueryProcedure<Resp> : never;
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

				return mutationProcedure as M extends "GET" ? never : RestMutationProcedure<Resp, Body>;
			},
		};
	}, [baseUrl, onUnauthorized]);
}
