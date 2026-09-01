import "server-only";

import { apiRouter, type ApiRouter } from "@workspace/client/lib/api/endpoints";
import {
	createServerCallerForRouter,
	createServerRequestContext,
	DEFAULT_WEB_SERVER_API_CONFIG,
	resolveConfig,
	type ServerApiConfig,
	type ServerCallerTree,
} from "@workspace/client/lib/api/server-api";

export type WebServerCaller = ServerCallerTree<ApiRouter>;

/**
 * Builds an SSR caller for any router tree using the web app's cookie config.
 * Pass `apiRouter` (default via `createWebServerCaller`) or a custom subtree.
 */
export function createWebServerCallerForRouter<R extends object>(router: R, config?: Partial<ServerApiConfig>): ServerCallerTree<R> {
	const resolved: ServerApiConfig = resolveConfig({ ...DEFAULT_WEB_SERVER_API_CONFIG, ...config });
	const context = createServerRequestContext(resolved, apiRouter.auth.refresh);
	return createServerCallerForRouter(router, context);
}

/** Server-side API caller for the consumer web app (forwards web auth cookies). */
export function createWebServerCaller(config?: Partial<ServerApiConfig>): WebServerCaller {
	return createWebServerCallerForRouter(apiRouter, config);
}

export {
	createServerCallerForRouter,
	createServerRequestContext,
	DEFAULT_WEB_SERVER_API_CONFIG,
	type ServerApiConfig,
	type ServerCallerTree,
} from "@workspace/client/lib/api/server-api";
