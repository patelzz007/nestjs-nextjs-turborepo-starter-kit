import "server-only";

import { apiRouter, type ApiRouter } from "@workspace/client/lib/api/endpoints";
import {
	createServerCallerForRouter,
	createServerRequestContext,
	DEFAULT_MERCHANT_SERVER_API_CONFIG,
	resolveConfig,
	type ServerApiConfig,
	type ServerCallerTree,
} from "@workspace/client/lib/api/server-api";
import type { MerchantMembershipResponse } from "@workspace/shared";
import { cookies } from "next/headers";

import { MERCHANT_ORG_COOKIE_NAME, merchantOrgHeaders } from "@/lib/merchant-org";

export type MerchantServerCaller = ServerCallerTree<ApiRouter>;

/**
 * Builds an SSR caller for any router tree using the merchant app's cookie config.
 */
export function createMerchantServerCallerForRouter<R extends object>(router: R, config?: Partial<ServerApiConfig>): ServerCallerTree<R> {
	const resolved: ServerApiConfig = resolveConfig({ ...DEFAULT_MERCHANT_SERVER_API_CONFIG, ...config });
	const context = createServerRequestContext(resolved, apiRouter.auth.refresh);
	return createServerCallerForRouter(router, context);
}

/** Server-side API caller for the merchant app (forwards isolated merchant auth cookies). */
export function createMerchantServerCaller(config?: Partial<ServerApiConfig>): MerchantServerCaller {
	return createMerchantServerCallerForRouter(apiRouter, config);
}

export interface MerchantServerContext {
	readonly server: MerchantServerCaller;
	readonly memberships: readonly MerchantMembershipResponse[];
	readonly merchantOrgId: string | undefined;
	readonly merchantHeaders: Readonly<Record<string, string>> | undefined;
}

export async function readMerchantOrgIdCookie(): Promise<string | undefined> {
	const cookieStore = await cookies();
	const value = cookieStore.get(MERCHANT_ORG_COOKIE_NAME)?.value;
	if (value === undefined || value.length === 0) {
		return undefined;
	}
	return value;
}

export function resolveMerchantOrgId(memberships: readonly MerchantMembershipResponse[], preferredOrgId: string | undefined): string | undefined {
	if (preferredOrgId !== undefined && memberships.some((row) => row.merchantOrgId === preferredOrgId)) {
		return preferredOrgId;
	}
	const first = memberships[0];
	return first?.merchantOrgId;
}

/** Loads memberships + active org context for SSR panel routes. */
export async function loadMerchantServerContext(): Promise<MerchantServerContext> {
	const server = createMerchantServerCaller();
	const preferredOrgId = await readMerchantOrgIdCookie();

	let memberships: readonly MerchantMembershipResponse[] = [];
	try {
		const response = await server.merchant.me.query({});
		memberships = response.data;
	} catch {
		memberships = [];
	}

	const merchantOrgId = resolveMerchantOrgId(memberships, preferredOrgId);

	return {
		server,
		memberships,
		merchantOrgId,
		merchantHeaders: merchantOrgHeaders(merchantOrgId),
	};
}

export {
	createServerCallerForRouter,
	createServerRequestContext,
	DEFAULT_MERCHANT_SERVER_API_CONFIG,
	type ServerApiConfig,
	type ServerCallerTree,
} from "@workspace/client/lib/api/server-api";
