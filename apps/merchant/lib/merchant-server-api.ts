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
import type { OrganizationRewardMembershipResponse } from "@workspace/shared";
import { cookies } from "next/headers";

import { resolveOrganizationSlugFromContext } from "@/lib/org/resolve-slug";
import { ORGANIZATION_LOCATION_ID_COOKIE_NAME } from "@/lib/org/location";
import { ORGANIZATION_SLUG_COOKIE_NAME } from "@/lib/org/slug";

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
	readonly memberships: readonly OrganizationRewardMembershipResponse[];
	readonly organizationSlug: string | undefined;
}

export async function readOrganizationSlugCookie(): Promise<string | undefined> {
	const cookieStore = await cookies();
	const value = cookieStore.get(ORGANIZATION_SLUG_COOKIE_NAME)?.value;
	if (value === undefined || value.length === 0) {
		return undefined;
	}
	return value;
}

export async function readOrganizationLocationCookie(): Promise<string | undefined> {
	const cookieStore = await cookies();
	const value = cookieStore.get(ORGANIZATION_LOCATION_ID_COOKIE_NAME)?.value;
	if (value === undefined || value.length === 0) {
		return undefined;
	}
	return value;
}

/** Loads memberships + active organization slug for SSR panel routes. */
export async function loadMerchantServerContext(): Promise<MerchantServerContext> {
	const server = createMerchantServerCaller();
	const preferredSlug = await readOrganizationSlugCookie();

	let memberships: readonly OrganizationRewardMembershipResponse[] = [];
	try {
		const response = await server.organizations.membershipsBootstrap.query({});
		memberships = response.data;
	} catch {
		memberships = [];
	}

	const organizationSlug = resolveOrganizationSlugFromContext(memberships, preferredSlug);

	return {
		server,
		memberships,
		organizationSlug,
	};
}

export {
	createServerCallerForRouter,
	createServerRequestContext,
	DEFAULT_MERCHANT_SERVER_API_CONFIG,
	type ServerApiConfig,
	type ServerCallerTree,
} from "@workspace/client/lib/api/server-api";
