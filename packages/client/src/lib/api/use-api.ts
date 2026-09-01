// ============================================
// lib/use-api.ts - Cookie-based API hook (endpoint-agnostic)
// ============================================
"use client";

import type { DataValue, SerializableInput } from "@workspace/shared";
import { useMemo } from "react";

import { createApiRequestContext, type ApiClientType, type ApiRequestContext, type OnRefresh, type OnUnauthorized, type UseApiOptions } from "./api-request";
import { buildClientRouter, createProcedureForDef, type ClientMutationProcedure, type ClientQueryProcedure, type ClientRouterTree } from "./client-router";
import type { MutationDef, ProcedureDef, QueryDef, RouterTree } from "./endpoints";

export {
	createApiRequestContext,
	createCaller,
	createRefreshCooldown,
	createUncheckedApiRequestContext,
	fetchMutation,
	fetchMutationOrThrow,
	fetchMutationUnchecked,
	fetchQuery,
	fetchQueryOrThrow,
	ApiError,
	ApiErrorSchema,
	type ApiClientType,
	type ApiErrorBody,
	type ApiErrorPayload,
	type ApiRequestContext,
	type ApiResponse,
	type ApiSuccess,
	type ApiFailure,
	type BaseRequestOptions,
	type CallerTree,
	type HttpMethod,
	type MutationCaller,
	type OnRefresh,
	type OnUnauthorized,
	type ProcedureCallOptions,
	type QueryCaller,
	type RefreshCall,
	type RefreshResult,
	type RequestOptions,
	type UncheckedApiRequestContext,
	type UseApiOptions,
} from "./api-request";

export type { ClientMutationProcedure, ClientQueryProcedure, ClientRouterTree } from "./client-router";

export interface ApiClientProcedureBinding {
	procedure<Input extends SerializableInput, Resp extends DataValue>(def: QueryDef<Input, Resp>): ClientQueryProcedure<Input, Resp>;
	procedure<Input extends SerializableInput, Resp extends DataValue>(def: MutationDef<Input, Resp>): ClientMutationProcedure<Input, Resp>;
	procedure<Input extends SerializableInput, Resp extends DataValue>(def: ProcedureDef<Input, Resp>): ClientQueryProcedure<Input, Resp> | ClientMutationProcedure<Input, Resp>;
}

/** `procedure()` binder + the typed router tree for `R`. */
export type ApiClient<R extends object = RouterTree> = ApiClientProcedureBinding & ClientRouterTree<R>;

/** @deprecated alias — use `ApiClient`. */
export type UseApiReturn<R extends object = RouterTree> = ApiClient<R>;

/**
 * Generic API hook — pass any endpoint router; this module has no endpoint dependencies.
 *
 * @param router - Typed procedure tree (e.g. `apiRouter` from `./endpoints`)
 * @param baseUrl - Base URL of the API
 * @param onUnauthorized - Called when a request is still 401 after refresh
 * @param onRefresh - Called on 401 to silently refresh the session
 */
export function useApi<R extends object>(router: R, baseUrl: string, onUnauthorized: OnUnauthorized, onRefresh: OnRefresh, options?: UseApiOptions): ApiClient<R> {
	const clientType: ApiClientType | undefined = options?.clientType;
	const extraHeaders: Record<string, string> | undefined = options?.extraHeaders;

	return useMemo(() => {
		const routerContext: ApiRequestContext = createApiRequestContext(baseUrl, onUnauthorized, onRefresh, { clientType, extraHeaders });

		function procedure<Input extends SerializableInput, Resp extends DataValue>(def: QueryDef<Input, Resp>): ClientQueryProcedure<Input, Resp>;
		function procedure<Input extends SerializableInput, Resp extends DataValue>(def: MutationDef<Input, Resp>): ClientMutationProcedure<Input, Resp>;
		function procedure<Input extends SerializableInput, Resp extends DataValue>(
			def: ProcedureDef<Input, Resp>,
		): ClientQueryProcedure<Input, Resp> | ClientMutationProcedure<Input, Resp>;
		function procedure<Input extends SerializableInput, Resp extends DataValue>(
			def: ProcedureDef<Input, Resp>,
		): ClientQueryProcedure<Input, Resp> | ClientMutationProcedure<Input, Resp> {
			return createProcedureForDef(routerContext, def);
		}

		return {
			procedure,
			...buildClientRouter(router, routerContext),
		};
	}, [router, baseUrl, clientType, extraHeaders, onUnauthorized, onRefresh]);
}
