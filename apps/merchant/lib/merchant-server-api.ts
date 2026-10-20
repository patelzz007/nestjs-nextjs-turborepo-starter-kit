import "server-only";

import { createServerCaller, type ServerCaller } from "@workspace/client/lib/api/server-api";
import { settleServerQuery } from "@workspace/client/lib/api/server-query-outcome";
import { loadServerSessionOutcome, type ServerSessionOutcome } from "@workspace/client/lib/contexts/identity/session/load-server-session";
import { UuidParamSchema, type Envelope, type OrganizationContextResponse, type OrganizationRewardMembershipResponse } from "@workspace/shared";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { readSidebarOpenCookie } from "@workspace/client/lib/features/sidebar/open-cookie";

import { MERCHANT_SIDEBAR_STORAGE_KEY } from "@/lib/navigation/sidebar-menu";
import { organizationLocationCookieName } from "@/contexts/organizations/lib/org/location";
import { SWITCHER_MEMBERSHIPS_QUERY } from "@/contexts/organizations/lib/org/memberships-query";
import { isCanonicalOrganizationSlug, isOrganizationRouteKey } from "@/contexts/organizations/lib/org/resolve-slug";
import { ORGANIZATION_SLUG_COOKIE_NAME } from "@/contexts/organizations/lib/org/slug";
import { ROUTES } from "@/lib/routes";

export type MerchantServerCaller = ServerCaller;

/** Read-only server-side API caller for the merchant app (forwards isolated merchant auth cookies). */
export function createMerchantServerCaller(): MerchantServerCaller {
	return createServerCaller({ clientType: "merchant" });
}

/**
 * This request's session as the API describes it (`/auth/me` +
 * `/auth/permissions`), asked once per request (`React.cache`). The root
 * layout starts the auth store from it, so the first paint already knows who
 * is signed in (the super-admin impersonation panel, the session's scope). An
 * outage only leaves the store to the browser's session check: the org layout
 * renders it through its own memberships call.
 */
export const loadMerchantServerSession = cache((): Promise<ServerSessionOutcome> => loadServerSessionOutcome(createMerchantServerCaller()));

export interface MerchantServerContext {
	readonly server: MerchantServerCaller;
	/**
	 * The first page of the user's memberships as the API answered it (the API's own envelope, real `meta`) —
	 * a CONFIRMED answer (an outage never reaches here). Seeds the shell's memberships query; `meta.total` says
	 * whether the user belongs to any organization at all.
	 */
	readonly membershipsEnvelope: Envelope<OrganizationRewardMembershipResponse[]>;
	/** The organization an entry page opens: the validated preference, else the first membership; `undefined` without one. */
	readonly organizationSlug: string | undefined;
}

/** Whether the member left the desktop sidebar open (its cookie — open-cookie.ts); `undefined` when never set. */
export async function readSidebarOpen(): Promise<boolean | undefined> {
	return readSidebarOpenCookie(await cookies(), MERCHANT_SIDEBAR_STORAGE_KEY);
}

/**
 * The `organizationSlug` preference cookie, when it holds a canonical slug. A cookie is client input: it is
 * only followed once the API confirmed the user belongs to it (`loadPreferredOrganizationSlug`).
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
	// A segment that is neither a slug nor an organization id names no organization (and would be a 400).
	if (!isOrganizationRouteKey(orgSlug)) {
		return undefined;
	}
	const server = createMerchantServerCaller();
	const [result] = await Promise.allSettled([server.organizations.context.query({ orgSlug })]);
	const outcome = settleServerQuery(result, { label: "organizations.context", expected: ["unauthenticated", "forbidden", "not-found"] });
	return outcome.kind === "ok" ? outcome.data : undefined;
});

/**
 * The preferred organization (the `organizationSlug` cookie) when the API confirms the user is a member of it
 * (its organization context loads), else `undefined`. Memoized per request.
 */
export const loadPreferredOrganizationSlug = cache(async (): Promise<string | undefined> => {
	const preferredSlug = await readOrganizationSlugCookie();
	if (preferredSlug === undefined) {
		return undefined;
	}
	return (await loadOrganizationContext(preferredSlug))?.data.organization.slug;
});

/**
 * Loads the first page of memberships + the entry organization for SSR panel routes. Memoized per request
 * (`React.cache`), so the org layout and the page share one memberships call. Only a CONFIRMED answer leaves
 * here: a session the API no longer accepts goes to sign-in, and every other failure (outage, timeout, 5xx,
 * an unexpected 403) is logged and rethrown to `error.tsx` — an outage must never read as "this merchant has
 * no organization" (which would send an existing merchant to onboarding).
 */
export const loadMerchantServerContext = cache(async (): Promise<MerchantServerContext> => {
	const server = createMerchantServerCaller();
	const [preferredSlug, [membershipsResult]] = await Promise.all([
		loadPreferredOrganizationSlug(),
		Promise.allSettled([server.organizations.membershipsBootstrap.query(SWITCHER_MEMBERSHIPS_QUERY)]),
	]);

	const outcome = settleServerQuery(membershipsResult, { label: "organizations.membershipsBootstrap", expected: ["unauthenticated"] });
	if (outcome.kind === "unauthenticated") {
		redirect(ROUTES.auth.login);
	}

	return {
		server,
		membershipsEnvelope: outcome.data,
		organizationSlug: preferredSlug ?? outcome.data.data.at(0)?.organizationSlug,
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
