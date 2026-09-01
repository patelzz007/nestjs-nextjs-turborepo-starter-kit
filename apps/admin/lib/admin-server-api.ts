import "server-only";

import { apiRouter, type ApiRouter } from "@workspace/client/lib/api/endpoints";
import {
	createServerCallerForRouter,
	createServerRequestContext,
	DEFAULT_SERVER_API_CONFIG,
	resolveConfig,
	type ServerApiConfig,
	type ServerCallerTree,
} from "@workspace/client/lib/api/server-api";

export type AdminServerCaller = ServerCallerTree<ApiRouter>;

/**
 * Builds an SSR caller for any router tree using the admin app's cookie config.
 */
export function createAdminServerCallerForRouter<R extends object>(router: R, config?: Partial<ServerApiConfig>): ServerCallerTree<R> {
	const resolved: ServerApiConfig = resolveConfig({ ...DEFAULT_SERVER_API_CONFIG, ...config });
	const context = createServerRequestContext(resolved, apiRouter.auth.refresh);
	return createServerCallerForRouter(router, context);
}

/** Server-side API caller for the admin app (forwards admin auth cookies). */
export function createAdminServerCaller(config?: Partial<ServerApiConfig>): AdminServerCaller {
	return createAdminServerCallerForRouter(apiRouter, config);
}

export {
	createServerCallerForRouter,
	createServerRequestContext,
	DEFAULT_SERVER_API_CONFIG,
	type ServerApiConfig,
	type ServerCallerTree,
} from "@workspace/client/lib/api/server-api";
