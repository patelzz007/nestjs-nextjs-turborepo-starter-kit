// ============================================
// lib/use-api.ts - Cookie-based API hook (endpoint-agnostic)
// ============================================
// The web binding of `@workspace/api-client`: the client is built from the
// injected config with the COOKIE transport (`credentials: "include"`), its
// hooks come from `@workspace/api-client/react`, and the web-only file
// download (`download.ts`) is bound to the same request context.
"use client";

import { createApiClientContext, type ApiRequestContext } from "@workspace/api-client";
import { buildClientRouter, createProcedureForDef, type ClientMutationProcedure, type ClientQueryProcedure, type ClientRouterTree } from "@workspace/api-client/react";
import type { AuthClientType, DataValue, SerializableInput } from "@workspace/shared";
import { useMemo } from "react";

import type { OnRefresh, OnUnauthorized } from "./api-request";
import { fetchDownload, type DownloadDef, type DownloadedFile, type DownloadOptions } from "./download";
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
	SessionRefreshUnavailableError,
	type ApiErrorBody,
	type ApiErrorPayload,
	type ApiRequestContext,
	type ApiResponse,
	type ApiSuccess,
	type ApiFailure,
	type CallerTree,
	type HttpMethod,
	type MutationCaller,
	type OnRefresh,
	type OnUnauthorized,
	type ProcedureCallOptions,
	type QueryCaller,
	type RefreshCall,
	type RefreshResult,
	type UncheckedApiRequestContext,
} from "./api-request";

export type { ClientMutationProcedure, ClientQueryProcedure, ClientRouterTree } from "@workspace/api-client/react";

export interface ApiClientProcedureBinding {
	procedure<Input extends SerializableInput, Resp extends DataValue>(def: QueryDef<Input, Resp>): ClientQueryProcedure<Input, Resp>;
	procedure<Input extends SerializableInput, Resp extends DataValue>(def: MutationDef<Input, Resp>): ClientMutationProcedure<Input, Resp>;
	procedure<Input extends SerializableInput, Resp extends DataValue>(def: ProcedureDef<Input, Resp>): ClientQueryProcedure<Input, Resp> | ClientMutationProcedure<Input, Resp>;
	/**
	 * Downloads a file route (`apiDownloads.*`) with this client's session and
	 * refresh pipeline — `fetchDownload` bound to the hook's request context.
	 */
	download<Input extends SerializableInput>(
		def: DownloadDef<Input>,
		input: Input,
		options?: DownloadOptions & { readonly fallbackFileName?: string | undefined },
	): Promise<DownloadedFile>;
}

/** `procedure()` binder + the typed router tree for `R`. */
export type ApiClient<R extends object = RouterTree> = ApiClientProcedureBinding & ClientRouterTree<R>;

/**
 * Generic API hook — pass any endpoint router; this module has no endpoint dependencies.
 *
 * @param router - Typed procedure tree (e.g. `apiRouter` from `./endpoints`)
 * @param baseUrl - Base URL of the API
 * @param clientType - The frontend whose isolated cookie set every call uses
 * @param onUnauthorized - Called when a request is still 401 after refresh
 * @param onRefresh - Called on 401 to silently refresh the session
 */
export function useApi<R extends object>(router: R, baseUrl: string, clientType: AuthClientType, onUnauthorized: OnUnauthorized, onRefresh: OnRefresh): ApiClient<R> {
	return useMemo(() => {
		const routerContext: ApiRequestContext = createApiClientContext({
			baseUrl,
			clientType,
			transport: { kind: "cookie", refreshSession: onRefresh },
			onSessionExpired: onUnauthorized,
		});

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

		function download<Input extends SerializableInput>(
			def: DownloadDef<Input>,
			input: Input,
			options?: DownloadOptions & { readonly fallbackFileName?: string | undefined },
		): Promise<DownloadedFile> {
			return fetchDownload(routerContext, def, input, options);
		}

		return {
			procedure,
			download,
			...buildClientRouter(router, routerContext),
		};
	}, [router, baseUrl, clientType, onUnauthorized, onRefresh]);
}
