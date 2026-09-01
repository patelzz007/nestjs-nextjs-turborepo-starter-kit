// ============================================
// lib/client-router.ts - React hooks over the tRPC-style caller
// ============================================

import {
	useQuery as rqUseQuery,
	useMutation as rqUseMutation,
	type QueryKey,
	type UseQueryOptions,
	type UseQueryResult,
	type UseMutationOptions,
	type UseMutationResult,
} from "@tanstack/react-query";
import type { DataValue, SerializableInput } from "@workspace/shared";

import { createMutationCaller, createQueryCaller, type ApiRequestContext, type ApiResponse } from "./api-request";
import {
	eachRouterEntry,
	isErasedProcedureDef,
	isRouterSubtree,
	type MutationDef,
	type ProcedureDef,
	type QueryDef,
	type RouterTree,
	type RouterTreeValue,
} from "./endpoints";

/** A GET procedure on the client — `.useQuery()` / `.fetch()` / `.fetchOrThrow()`. */
export interface ClientQueryProcedure<Input, Resp> {
	useQuery(input: Input, queryOptions?: Omit<UseQueryOptions<Resp, Error, Resp>, "queryKey" | "queryFn">, overrideQueryKey?: QueryKey): UseQueryResult<Resp>;
	fetch(input: Input): Promise<ApiResponse<Resp>>;
	fetchOrThrow(input: Input): Promise<Resp>;
}

/** A mutation procedure on the client — `.useMutation()` / `.mutate()`. */
export interface ClientMutationProcedure<Input, Resp> {
	useMutation(mutationOptions?: UseMutationOptions<Resp, Error, Input>): UseMutationResult<Resp, Error, Input>;
	mutate(input: Input): Promise<Resp>;
}

/** Recursively maps the router tree to client procedures with React hooks. */
export type ClientRouterTree<R extends object> = {
	[K in keyof R]: R[K] extends QueryDef<infer Input, infer Resp>
		? ClientQueryProcedure<Input, Resp>
		: R[K] extends MutationDef<infer Input, infer Resp>
			? ClientMutationProcedure<Input, Resp>
			: R[K] extends object
				? ClientRouterTree<R[K]>
				: never;
};

/** @deprecated alias — use `ApiRequestContext` from `api-request`. */
export type BuildClientRouterContext = ApiRequestContext;

export function createQueryProcedure<Input extends SerializableInput, Resp extends DataValue>(
	context: ApiRequestContext,
	def: QueryDef<Input, Resp>,
): ClientQueryProcedure<Input, Resp> {
	const caller = createQueryCaller(context, def);
	return {
		useQuery: (input, queryOptions?, overrideQueryKey?): UseQueryResult<Resp> => {
			const key: QueryKey = overrideQueryKey ?? def.queryKey(input);
			return rqUseQuery<Resp, Error, Resp>({
				queryKey: key,
				queryFn: ({ signal }): Promise<Resp> => caller.fetchOrThrow(input, { signal }),
				...queryOptions,
			});
		},
		fetch: caller.fetch,
		fetchOrThrow: caller.fetchOrThrow,
	};
}

export function createMutationProcedure<Input extends SerializableInput, Resp extends DataValue>(
	context: ApiRequestContext,
	def: MutationDef<Input, Resp>,
): ClientMutationProcedure<Input, Resp> {
	const caller = createMutationCaller(context, def);
	return {
		useMutation: (mutationOptions?): UseMutationResult<Resp, Error, Input> => rqUseMutation<Resp, Error, Input>({ mutationFn: caller.mutate, ...mutationOptions }),
		mutate: caller.mutate,
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

type ClientRouterTreeBranch<V> =
	V extends QueryDef<infer Input, infer Resp>
		? ClientQueryProcedure<Input, Resp>
		: V extends MutationDef<infer Input, infer Resp>
			? ClientMutationProcedure<Input, Resp>
			: V extends object
				? ClientRouterTree<V>
				: never;

function mapClientRouterBranch<V extends object>(context: ApiRequestContext, value: V): ClientRouterTreeBranch<V> {
	if (isErasedProcedureDef(value)) {
		return createProcedureForDef(context, value);
	}
	if (isRouterSubtree(value)) {
		return buildClientRouter(value, context);
	}
	throw new Error("Invalid router node — expected a procedure leaf or nested router.");
}

function isCompleteClientRouter<R extends object>(router: R, candidate: Partial<ClientRouterTree<R>>): candidate is ClientRouterTree<R> {
	let complete = true;
	eachRouterEntry(router, (key) => {
		if (candidate[key] === undefined) {
			complete = false;
		}
	});
	return complete;
}

/**
 * Walks an endpoint router tree and binds every leaf to a React procedure.
 * Transport is delegated to the tRPC-style caller in `api-request`.
 */
export function buildClientRouter<R extends object>(router: R, context: ApiRequestContext): ClientRouterTree<R> {
	const out: Partial<ClientRouterTree<R>> = {};

	eachRouterEntry(router, (key, value) => {
		out[key] = mapClientRouterBranch(context, value);
	});

	if (!isCompleteClientRouter(router, out)) {
		throw new Error("Failed to build client router — one or more router entries were not bound.");
	}

	return out;
}
