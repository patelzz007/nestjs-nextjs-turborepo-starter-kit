// ============================================
// api.ts - the mobile app's API client
// ============================================
// One @workspace/api-client context per app start (it holds the single-flight
// refresh): client type `mobile`, the token transport backed by Secure Store,
// the app version (`X-App-Version`, ADR 033) and the device headers
// (`X-Device-Model` / `X-Device-Name`). Built once by the app runtime and handed
// to screens through ApiClientProvider (src/lib/api-context.tsx).

import { apiRouter, createApiClientContext, type ApiRequestContext, type ApiRouter, type OnSessionExpired, type TokenProvider } from "@workspace/api-client";
import { buildClientRouter, type ClientRouterTree } from "@workspace/api-client/react";

export interface MobileApiClient {
	/** The request context: for core calls (`fetchBodyTokenLifecycleMutation`, the transport's refresh). */
	readonly context: ApiRequestContext;
	/** The typed router with TanStack Query hooks. */
	readonly api: ClientRouterTree<ApiRouter>;
}

export interface MobileApiClientOptions {
	readonly baseUrl: string;
	readonly appVersion: string;
	readonly deviceHeaders: Record<string, string>;
	readonly tokenProvider: TokenProvider;
	readonly onSessionExpired: OnSessionExpired;
}

/** @throws {InvalidApiClientConfigError} when the config is wrong — at app start, never on the first request. */
export function createMobileApiClient(options: MobileApiClientOptions): MobileApiClient {
	const context = createApiClientContext({
		baseUrl: options.baseUrl,
		clientType: "mobile",
		transport: { kind: "token", tokenProvider: options.tokenProvider },
		appVersion: options.appVersion,
		headers: options.deviceHeaders,
		onSessionExpired: options.onSessionExpired,
	});
	return { context, api: buildClientRouter(apiRouter, context) };
}
