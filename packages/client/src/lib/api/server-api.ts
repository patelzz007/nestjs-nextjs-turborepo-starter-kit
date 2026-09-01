// ============================================
// lib/server-api.ts - SSR entry point (wires apiRouter at the app boundary)
// ============================================
import "server-only";

import { apiRouter, type ApiRouter } from "./endpoints";
import { createServerCallerForRouter, createServerRequestContext, resolveConfig, type ServerApiConfig, type ServerCallerTree } from "./server-request";

export {
	classifyError,
	createDefaultLogger,
	createServerCallerForRouter,
	createServerRequestContext,
	DEFAULT_MERCHANT_SERVER_API_CONFIG,
	DEFAULT_SERVER_API_CONFIG,
	DEFAULT_WEB_SERVER_API_CONFIG,
	describeFailure,
	fetchServerMutation,
	fetchServerQuery,
	isPrefetchFailure,
	refreshAccessToken,
	resolveConfig,
	type PrefetchCallOptions,
	type PrefetchFailure,
	type PrefetchLogEvent,
	type PrefetchOutcome,
	type ServerApiConfig,
	type ServerApiLogLevel,
	type ServerCallerBranch,
	type ServerCallerTree,
	type ServerMutationLeaf,
	type ServerQueryLeaf,
	type ServerRequestContext,
} from "./server-request";

/** Typed server caller for the default `apiRouter`. */
export type ServerCaller = ServerCallerTree<ApiRouter>;

/**
 * Creates the SSR caller for `apiRouter` with the given config.
 * For custom routers, use `createServerCallerForRouter(router, context)` directly.
 */
export function createServerCaller(config?: Partial<ServerApiConfig>): ServerCaller {
	const resolved: ServerApiConfig = resolveConfig(config);
	const context = createServerRequestContext(resolved, apiRouter.auth.refresh);
	return createServerCallerForRouter(apiRouter, context);
}

export type { MutationDef, ProcedureDef, QueryDef } from "./endpoints";
