import { createGrantedCapabilities, isCapabilityGranted } from "@workspace/client/lib/auth/permission-check";
import { IMPLICIT_SELF_GRANTS, PERMISSION, toPlatformCapabilitySlug, type CapabilitySlug } from "@workspace/shared";
import { describe, expect, it } from "vitest";

import { ADMIN_ROUTE_AUTHORIZATION, resolveRouteAuthorization, type RouteAuthorizationRule } from "@/lib/navigation/route-authorization";
import { ROUTE_PATTERNS, ROUTES } from "@/lib/routes";

/** One API call a page makes on load, and the permission the API route requires (its `@RequirePermission`). */
interface PageApiCall {
	readonly endpoint: string;
	readonly permission: CapabilitySlug;
	/**
	 * The call only ever targets the caller's OWN record (`resourceId: self()` on
	 * the API, e.g. `GET /auth/profile`), where the API grants the
	 * `IMPLICIT_SELF_GRANTS` to every signed-in session — so no assigned
	 * permission is needed. Only valid for a permission in that list (asserted below).
	 */
	readonly ownRecord?: boolean;
}

/** The capability slugs every signed-in session holds on its own records. */
const IMPLICIT_SELF_GRANT_SLUGS: ReadonlySet<CapabilitySlug> = new Set<CapabilitySlug>(
	IMPLICIT_SELF_GRANTS.map((pair) => toPlatformCapabilitySlug(pair.action, pair.resource)),
);

function isCoveredByOwnRecordGrant(call: PageApiCall): boolean {
	return call.ownRecord === true && IMPLICIT_SELF_GRANT_SLUGS.has(call.permission);
}

/**
 * Every permission-gated page → the API calls it makes when it renders (the
 * server prefetch and the client queries that run without a further check).
 * Maintained next to the pages: adding a call to a page means adding it here,
 * and the test then proves the page's route rule lets through only sessions
 * that may make that call. Calls a page gates itself (a tab or button shown
 * only with its own permission) are not listed.
 */
const PAGE_API_CALLS: ReadonlyMap<string, readonly PageApiCall[]> = new Map<string, readonly PageApiCall[]>([
	// The export (GET /admin/analytics/export) needs the same READ ANALYTICS.
	[ROUTES.analytics.index, [{ endpoint: "GET /admin/analytics/dashboard", permission: PERMISSION.ANALYTICS.READ }]],
	[ROUTES.catalog.products.list, [{ endpoint: "GET /product", permission: PERMISSION.PRODUCT.LIST }]],
	[
		ROUTES.catalog.products.create,
		[
			{ endpoint: "GET /sample-category (category picker)", permission: PERMISSION.SAMPLE_CATEGORY.LIST },
			{ endpoint: "GET /sample-category/:id (picked category label)", permission: PERMISSION.SAMPLE_CATEGORY.READ },
		],
	],
	[ROUTE_PATTERNS.catalog.products.detail, [{ endpoint: "GET /product/:id", permission: PERMISSION.PRODUCT.READ }]],
	[
		ROUTE_PATTERNS.catalog.products.edit,
		[
			{ endpoint: "GET /product/:id", permission: PERMISSION.PRODUCT.READ },
			{ endpoint: "GET /sample-category (category picker)", permission: PERMISSION.SAMPLE_CATEGORY.LIST },
			{ endpoint: "GET /sample-category/:id (picked category label)", permission: PERMISSION.SAMPLE_CATEGORY.READ },
		],
	],
	[ROUTES.catalog.categories.list, [{ endpoint: "GET /sample-category", permission: PERMISSION.SAMPLE_CATEGORY.LIST }]],
	[ROUTES.catalog.categories.create, []],
	[ROUTE_PATTERNS.catalog.categories.detail, [{ endpoint: "GET /sample-category/:id", permission: PERMISSION.SAMPLE_CATEGORY.READ }]],
	[ROUTE_PATTERNS.catalog.categories.edit, [{ endpoint: "GET /sample-category/:id", permission: PERMISSION.SAMPLE_CATEGORY.READ }]],
	[
		ROUTES.emails.templates,
		[
			{ endpoint: "GET /notifications/email-preview", permission: PERMISSION.EMAIL.READ },
			{ endpoint: "GET /notifications/email-preview/:key", permission: PERMISSION.EMAIL.READ },
		],
	],
	[ROUTES.emails.log, [{ endpoint: "GET /notifications/email-log", permission: PERMISSION.EMAIL.LIST }]],
	[ROUTES.geography.index, [{ endpoint: "GET /geo/stats + the active tab's list", permission: PERMISSION.GEO.READ }]],
	[ROUTES.merchants.list, [{ endpoint: "GET /admin/organizations", permission: PERMISSION.MERCHANT_ORG.LIST }]],
	// Nothing on load: the preview (POST /admin/invites/preview-email) and the send need the page's own MANAGE.
	[ROUTES.merchants.invites, []],
	[ROUTES.merchants.verification, [{ endpoint: "GET /admin/organizations", permission: PERMISSION.MERCHANT_ORG.LIST }]],
	[ROUTES.merchants.storeRequests, [{ endpoint: "GET /admin/organizations/location-requests", permission: PERMISSION.MERCHANT_ORG.LIST }]],
	[ROUTES.rewards.review, [{ endpoint: "GET /admin/rewards/pending", permission: PERMISSION.REWARD.MANAGE }]],
	// Each tab (roles list, permissions list, checker) is shown and queried only with its own permission.
	[ROUTES.settings.access, []],
	// Any signed-in admin: the page reads (and edits) only the caller's own profile.
	[ROUTES.account.profile, [{ endpoint: "GET /auth/profile", permission: PERMISSION.PROFILE.READ, ownRecord: true }]],
]);

/** The smallest grants that satisfy `rule`: each permission alone for "any", all of them together for "all". */
function minimalGrantsFor(rule: RouteAuthorizationRule): readonly (readonly CapabilitySlug[])[] {
	const authorization = rule.authorization;
	if (authorization === undefined) {
		return [[]];
	}
	return authorization.mode === "all" ? [authorization.permissions] : authorization.permissions.map((permission) => [permission]);
}

describe("every gated page's route rule covers the API calls it makes", () => {
	for (const [pattern, calls] of PAGE_API_CALLS) {
		it(pattern, () => {
			const rule = resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, pattern);
			expect(rule, pattern).not.toBeNull();
			if (rule === null) {
				return;
			}
			for (const grant of minimalGrantsFor(rule)) {
				const granted = createGrantedCapabilities(grant);
				for (const call of calls) {
					expect(
						isCoveredByOwnRecordGrant(call) || isCapabilityGranted(granted, call.permission),
						`${pattern}: a session holding only [${grant.join(", ")}] passes the guard but ${call.endpoint} needs ${call.permission}`,
					).toBe(true);
				}
			}
		});
	}

	it("accepts an own-record call only for a permission every session holds on its own records", () => {
		const ownRecordCalls = [...PAGE_API_CALLS.values()].flat().filter((call) => call.ownRecord === true);
		expect(ownRecordCalls.length).toBeGreaterThan(0);
		for (const call of ownRecordCalls) {
			expect(IMPLICIT_SELF_GRANT_SLUGS.has(call.permission), call.endpoint).toBe(true);
		}
		expect(isCoveredByOwnRecordGrant({ endpoint: "GET /product", permission: PERMISSION.PRODUCT.LIST, ownRecord: true })).toBe(false);
	});

	it("catches a page whose rule is narrower than its calls (the old invites page called the EMAIL READ template endpoint)", () => {
		const rule = resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, ROUTES.merchants.invites);
		const grants = rule === null ? [] : minimalGrantsFor(rule);
		const coversEmailRead = grants.every((grant) => isCapabilityGranted(createGrantedCapabilities(grant), PERMISSION.EMAIL.READ));
		expect(coversEmailRead).toBe(false);
	});
});
