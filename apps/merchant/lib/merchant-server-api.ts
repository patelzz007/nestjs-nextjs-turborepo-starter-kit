import "server-only";

import { createServerCaller, type ServerCaller } from "@workspace/client/lib/api/server-api";
import { settleServerQuery } from "@workspace/client/lib/api/server-query-outcome";
import { UuidParamSchema, type Envelope, type OrganizationContextResponse, type OrganizationRewardMembershipResponse } from "@workspace/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { organizationLocationCookieName } from "@/lib/org/location";
import { isCanonicalOrganizationSlug, resolveOrganizationSlugFromContext } from "@/lib/org/resolve-slug";
import { ORGANIZATION_SLUG_COOKIE_NAME } from "@/lib/org/slug";
import { ROUTES } from "@/lib/routes";

export type MerchantServerCaller = ServerCaller;

/** Read-only server-side API caller for the merchant app (forwards isolated merchant auth cookies). */
export function createMerchantServerCaller(): MerchantServerCaller {
	return createServerCaller({ clientType: "merchant" });
}

export interface MerchantServerContext {
	readonly server: MerchantServerCaller;
	/** The user's memberships as the API listed them — a CONFIRMED list (an outage never reaches here). */
	readonly memberships: readonly OrganizationRewardMembershipResponse[];
	/** The same answer as the API's own envelope (real `meta`), to seed the client's memberships query. */
	readonly membershipsEnvelope: Envelope<OrganizationRewardMembershipResponse[]>;
	readonly organizationSlug: string | undefined;
}

/**
 * The `organizationSlug` preference cookie, when it holds a canonical slug. A
 * cookie is client input: callers still match it against the memberships
 * (`resolveOrganizationSlugFromContext`) before following it anywhere.
 */
export async function readOrganizationSlugCookie(): Promise<string | undefined> {
	const cookieStore = await cookies();
	const value = cookieStore.get(ORGANIZATION_SLUG_COOKIE_NAME)?.value;
	if (value === undefined || !isCanonicalOrganizationSlug(value)) {
		return undefined;
	}
	return value;
}

/**
 * The member's chosen store in `orgSlug`, from that organization's
 * `organizationLocationId.<orgSlug>` cookie, or `null` when absent or not a
 * location id. A cookie is client input: this only checks its shape — whether
 * the member may use that store is decided by `loadServerLocationScope`
 * (against the membership's accessible locations).
 */
export async function readOrganizationLocationCookie(orgSlug: string): Promise<string | null> {
	const cookieStore = await cookies();
	const parsed = UuidParamSchema.safeParse(cookieStore.get(organizationLocationCookieName(orgSlug))?.value);
	return parsed.success ? parsed.data : null;
}

/**
 * The organization context (membership + locations) for `orgSlug`, memoized per
 * request (`React.cache`) so the org layout and the page share one call.
 * `undefined` when the API answers that the user may not read it (not signed
 * in, not a member, no such organization) — the page guard then denies. Any
 * other failure (API down, timeout, 5xx) is logged and rethrown to `error.tsx`.
 */
export const loadOrganizationContext = cache(async (orgSlug: string): Promise<Envelope<OrganizationContextResponse> | undefined> => {
	const server = createMerchantServerCaller();
	const [result] = await Promise.allSettled([server.organizations.context.query({ orgSlug })]);
	const outcome = settleServerQuery(result, { label: "organizations.context", expected: ["unauthenticated", "forbidden", "not-found"] });
	return outcome.kind === "ok" ? outcome.data : undefined;
});

/**
 * Loads memberships + active organization slug for SSR panel routes. Memoized
 * per request (`React.cache`), so the org layout, `guardOrgPage` and the page
 * share one memberships call. Only a CONFIRMED list leaves here: a session the
 * API no longer accepts goes to sign-in, and every other failure (outage,
 * timeout, 5xx, an unexpected 403) is logged and rethrown to `error.tsx` — an
 * outage must never read as "this merchant has no organization" (which would
 * send an existing merchant to onboarding).
 */
export const loadMerchantServerContext = cache(async (): Promise<MerchantServerContext> => {
	const server = createMerchantServerCaller();
	const [preferredSlug, [membershipsResult]] = await Promise.all([readOrganizationSlugCookie(), Promise.allSettled([server.organizations.membershipsBootstrap.query({})])]);

	const outcome = settleServerQuery(membershipsResult, { label: "organizations.membershipsBootstrap", expected: ["unauthenticated"] });
	if (outcome.kind === "unauthenticated") {
		redirect(ROUTES.auth.login);
	}
	const memberships: readonly OrganizationRewardMembershipResponse[] = outcome.data.data;

	return {
		server,
		memberships,
		membershipsEnvelope: outcome.data,
		organizationSlug: resolveOrganizationSlugFromContext(memberships, preferredSlug),
	};
});

/**
 * Organization a top-level entry page (`/`, `/account`) should open: the
 * cookie-preferred membership, else the first one. `undefined` when the user
 * has no organization yet (→ onboarding).
 */
export async function resolveMerchantEntryOrganizationSlug(): Promise<string | undefined> {
	const ctx = await loadMerchantServerContext();
	return ctx.organizationSlug;
}
