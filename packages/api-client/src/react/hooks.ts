// ============================================
// react/hooks.ts - React hooks over the tRPC-style caller
// ============================================
// The `./react` entry: binds every router leaf to TanStack Query
// (`useQuery` / `usePrefetch` / `useMutation`). Imports only `react` and
// `@tanstack/react-query` besides the core — no DOM, no Next — so the web apps
// and the mobile app share it. Query keys come from the router defs
// (`def.queryKey(input)`), the one key factory every client uses.

import {
	useQuery as rqUseQuery,
	useMutation as rqUseMutation,
	useQueryClient,
	type UseQueryOptions,
	type UseQueryResult,
	type UseMutationOptions,
	type UseMutationResult,
} from "@tanstack/react-query";
import type { DataValue, SerializableInput } from "@workspace/shared";
import { useCallback } from "react";

import { createMutationCaller, createQueryCaller, type ApiRequestContext, type ApiResponse, type ProcedureCallOptions } from "../request";
import { assertCompleteRouterTree, mapRouterTree, type MutationDef, type ProcedureDef, type QueryDef, type RouterTreeValue } from "../router";

/** A GET procedure on the client — `.useQuery()` / `.usePrefetch()` / `.fetch()` / `.fetchOrThrow()`. */
export interface ClientQueryProcedure<Input, Resp> {
	useQuery(input: Input, queryOptions?: Omit<UseQueryOptions<Resp, Error, Resp>, "queryKey" | "queryFn">): UseQueryResult<Resp>;
	/**
	 * A stable callback that warms the cache for `input` — call it on hover or focus, before the
	 * person commits, so the matching `useQuery` renders at once instead of loading. Same query key
	 * and fetcher as `useQuery`; an entry fresher than `staleTime` is not fetched again.
	 */
	usePrefetch(prefetchOptions?: { readonly staleTime?: number }): (input: Input) => void;
	fetch(input: Input, options?: ProcedureCallOptions): Promise<ApiResponse<Resp>>;
	fetchOrThrow(input: Input, options?: ProcedureCallOptions): Promise<Resp>;
}

/** A mutation procedure on the client — `.useMutation()` / `.mutate()`. */
export interface ClientMutationProcedure<Input, Resp> {
	useMutation(mutationOptions?: UseMutationOptions<Resp, Error, Input>): UseMutationResult<Resp, Error, Input>;
	mutate(input: Input): Promise<Resp>;
}

/** Recursively maps the router tree to client procedures with React hooks. */
export type ClientRouterTree<R extends object> = {
	[K in keyof R]: ClientRouterTreeBranch<R[K]>;
};

export function createQueryProcedure<Input extends SerializableInput, Resp extends DataValue>(
	context: ApiRequestContext,
	def: QueryDef<Input, Resp>,
): ClientQueryProcedure<Input, Resp> {
	const caller = createQueryCaller(context, def);
	return {
		useQuery: (input, queryOptions?): UseQueryResult<Resp> => {
			return rqUseQuery<Resp, Error, Resp>({
				queryKey: def.queryKey(input),
				queryFn: ({ signal }): Promise<Resp> => caller.fetchOrThrow(input, { signal }),
				...queryOptions,
			});
		},
		usePrefetch: (prefetchOptions?): ((input: Input) => void) => {
			const queryClient = useQueryClient();
			const staleTime = prefetchOptions?.staleTime;
			return useCallback(
				(input: Input): void => {
					queryClient
						.query({
							queryKey: def.queryKey(input),
							queryFn: ({ signal }): Promise<Resp> => caller.fetchOrThrow(input, { signal }),
							...(staleTime === undefined ? {} : { staleTime }),
						})
						.catch((): void => {
							// A prefetch is a best-effort warm-up: a failure leaves `useQuery` to fetch, and report, on its own.
						});
				},
				[queryClient, staleTime],
			);
		},
		fetch: (input: Input, options?: ProcedureCallOptions): Promise<ApiResponse<Resp>> => caller.fetch(input, options),
		fetchOrThrow: (input: Input, options?: ProcedureCallOptions): Promise<Resp> => caller.fetchOrThrow(input, options),
	};
}

export function createMutationProcedure<Input extends SerializableInput, Resp extends DataValue>(
	context: ApiRequestContext,
	def: MutationDef<Input, Resp>,
): ClientMutationProcedure<Input, Resp> {
	const caller = createMutationCaller(context, def);
	return {
		useMutation: (mutationOptions?): UseMutationResult<Resp, Error, Input> =>
			rqUseMutation<Resp, Error, Input>({
				mutationFn: (input: Input): Promise<Resp> => caller.mutate(input),
				...mutationOptions,
			}),
		mutate: (input: Input): Promise<Resp> => caller.mutate(input),
	};
}

export function createProcedureForDef<Input extends SerializableInput, Resp extends DataValue>(
	context: ApiRequestContext,
	def: ProcedureDef<Input, Resp>,
): ClientQueryProcedure<Input, Resp> | ClientMutationProcedure<Input, Resp> {
	if (def.kind === "query") {
		return createQueryProcedure(context, def);
	}
	return createMutationProcedure(context, def);
}

/**
 * Maps one router value to its client binding. Router values are always procedure
 * defs or nested routers (objects); a non-object value (never produced by
 * `defineQuery` / `defineMutation`) passes through unchanged.
 */
type ClientRouterTreeBranch<V> =
	V extends QueryDef<infer Input, infer Resp>
		? ClientQueryProcedure<Input, Resp>
		: V extends MutationDef<infer Input, infer Resp>
			? ClientMutationProcedure<Input, Resp>
			: V extends object
				? ClientRouterTree<V>
				: V;

/**
 * Walks an endpoint router tree and binds every leaf to a React procedure.
 * Transport is delegated to the tRPC-style caller in `request.ts`.
 */
export function buildClientRouter<R extends object>(router: R, context: ApiRequestContext): ClientRouterTree<R> {
	const { nodes, settledKeys } = mapRouterTree<R, ClientRouterTreeBranch<RouterTreeValue>>(router, {
		leaf: (def): ClientRouterTreeBranch<RouterTreeValue> => createProcedureForDef(context, def),
		router: (subtree): ClientRouterTreeBranch<RouterTreeValue> => buildClientRouter(subtree, context),
	});
	assertCompleteRouterTree<R, ClientRouterTree<R>>(router, nodes, settledKeys);
	return nodes;
}
