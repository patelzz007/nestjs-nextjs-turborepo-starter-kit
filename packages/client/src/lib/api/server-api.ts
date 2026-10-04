// ============================================
// lib/server-api.ts - SSR entry point (wires apiRouter at the app boundary)
// ============================================
import "server-only";

import { apiRouter, type ApiRouter } from "./endpoints";
import { createServerCallerForRouter, createServerRequestContext, resolveConfig, type ServerApiConfigInput, type ServerCallerTree } from "./server-request";

export {
	classifyError,
	createDefaultLogger,
	createServerCallerForRouter,
	createServerRequestContext,
	DEFAULT_SERVER_API_CONFIG,
	describeFailure,
	fetchServerQuery,
	isNoteworthyPrefetchFailure,
	isPrefetchFailure,
	resolveConfig,
	type PrefetchCallOptions,
	type PrefetchFailure,
	type PrefetchLogEvent,
	type PrefetchOutcome,
	type ServerApiConfig,
	type ServerApiConfigInput,
	type ServerApiLogLevel,
	type ServerCallerBranch,
	type ServerCallerTree,
	type ServerQueryLeaf,
	type ServerRequestContext,
} from "./server-request";

/** Typed (read-only) server caller for the default `apiRouter`. */
export type ServerCaller = ServerCallerTree<ApiRouter>;

/**
 * Creates the SSR caller for `apiRouter` for one frontend (`clientType` picks
 * the cookie set). For custom routers, use `createServerCallerForRouter`.
 */
export function createServerCaller(config: ServerApiConfigInput): ServerCaller {
	return createServerCallerForRouter(apiRouter, createServerRequestContext(resolveConfig(config)));
}

export type { QueryDef } from "./endpoints";
