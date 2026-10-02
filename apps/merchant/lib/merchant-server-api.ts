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
import { UuidParamSchema, type OrganizationContextResponse, type OrganizationRewardMembershipResponse } from "@workspace/shared";
import { cookies } from "next/headers";
import { cache } from "react";

import { clientEnv } from "@/lib/env/env.client";
import { resolveOrganizationSlugFromContext } from "@/lib/org/resolve-slug";
import { ORGANIZATION_LOCATION_ID_COOKIE_NAME } from "@/lib/org/location";
import { ORGANIZATION_SLUG_COOKIE_NAME } from "@/lib/org/slug";

export type MerchantServerCaller = ServerCallerTree<ApiRouter>;

/**
 * Builds an SSR caller for any router tree using the merchant app's cookie config.
 */
export function createMerchantServerCallerForRouter<R extends object>(router: R, config?: Partial<ServerApiConfig>): ServerCallerTree<R> {
	const resolved: ServerApiConfig = resolveConfig({ ...DEFAULT_MERCHANT_SERVER_API_CONFIG, clientOrigin: clientEnv.NEXT_PUBLIC_MERCHANT_URL, ...config });
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

/**
 * The member's chosen store from the `organizationLocationId` cookie, or `null`
 * when absent or not a location id. A cookie is client input: this only checks
 * its shape — access is decided by `loadServerLocationScope` (accessible
 * locations) and, authoritatively, by the API on every request.
 */
export async function readOrganizationLocationCookie(): Promise<string | null> {
	const cookieStore = await cookies();
	const parsed = UuidParamSchema.safeParse(cookieStore.get(ORGANIZATION_LOCATION_ID_COOKIE_NAME)?.value);
	return parsed.success ? parsed.data : null;
}

/**
 * The organization context (membership + locations) for `orgSlug`, memoized per
 * request (`React.cache`) so the org layout and the page share one call.
 * `undefined` when it cannot be loaded (not a member, API down) — callers
 * degrade to the client fetching it; the API stays the authority.
 */
export const loadOrganizationContext = cache(async (orgSlug: string): Promise<OrganizationContextResponse | undefined> => {
	const server = createMerchantServerCaller();
	try {
		const response = await server.organizations.context.query({ orgSlug });
		return response.data;
	} catch {
		return undefined;
	}
});

/**
 * Loads memberships + active organization slug for SSR panel routes. Memoized
 * per request (`React.cache`), so the org layout, `guardOrgPage` and the page
 * share one memberships call.
 */
export const loadMerchantServerContext = cache(async (): Promise<MerchantServerContext> => {
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
});

/**
 * Organization a top-level entry page (`/`, `/account`) should open: the
 * cookie-preferred membership, else the first one. `undefined` when the user
 * has no organization yet (→ onboarding).
 */
export async function resolveMerchantEntryOrganizationSlug(): Promise<string | undefined> {
	const ctx = await loadMerchantServerContext();
	const slug = ctx.organizationSlug ?? ctx.memberships[0]?.organizationSlug;
	return slug !== undefined && slug.length > 0 ? slug : undefined;
}

export {
	createServerCallerForRouter,
	createServerRequestContext,
	DEFAULT_MERCHANT_SERVER_API_CONFIG,
	type ServerApiConfig,
	type ServerCallerTree,
} from "@workspace/client/lib/api/server-api";
