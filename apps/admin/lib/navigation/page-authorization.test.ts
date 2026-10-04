/**
 * Guard tests tying the admin route guard to the app's real pages and to
 * every place that offers a link:
 *
 * 1. every `app/**\/page.tsx` has an explicit, reviewed access classification,
 *    and the guard's rule table (`ADMIN_ROUTE_AUTHORIZATION`) resolves each
 *    panel page to exactly that — a new page cannot ship unclassified;
 * 2. for a range of sessions, a sidebar / palette entry is visible exactly
 *    when the guard would render its page.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createGrantedCapabilities, isCapabilityGranted } from "@workspace/client/lib/auth/permission-check";
import { PERMISSION, type CapabilitySlug } from "@workspace/shared";
import { samplePathForPattern } from "@workspace/ui/lib/sidebar/navigation/route-patterns";
import { describe, expect, it } from "vitest";

import { filterCompiledSidebarMenu } from "@/lib/navigation/filter-menu-by-capabilities";
import {
	ADMIN_ROUTE_AUTHORIZATION,
	canAccessRoute,
	filterMenuByRouteAccess,
	isOpenRouteRule,
	resolveRouteAuthorization,
	type RouteAccessSession,
	type RouteAuthorizationRule,
} from "@/lib/navigation/route-authorization";
import type { CompiledSidebarMenuData, CompiledSidebarMenuItem } from "@/lib/navigation/sidebar";
import { SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { buildSearchableItems } from "@/lib/palette/search";
import { AUTH_SECTION_PREFIX, isPathWithin } from "@/lib/routes";

const APP_DIR: string = fileURLToPath(new URL("../../app", import.meta.url));

/** The route group whose layout mounts `RouteAuthorizationGuard`. */
const PANEL_GROUP = "(panel)";

interface DiscoveredPage {
	/** App Router pattern without route groups (`/catalog/products/[id]`). */
	readonly pattern: string;
	/** True when the page renders inside the guarded panel layout. */
	readonly inPanel: boolean;
}

function isRouteGroup(segment: string): boolean {
	return segment.startsWith("(") || segment.startsWith("@");
}

function isCatchAll(segment: string): boolean {
	return segment.startsWith("[...") || segment.startsWith("[[...");
}

/** Every `page.tsx` under `app/`, minus catch-alls (the panel's renders `notFound()`). */
function collectPages(dir: string, segments: readonly string[], pages: DiscoveredPage[]): void {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isFile() && entry.name === "page.tsx") {
			if (!segments.some(isCatchAll)) {
				const urlSegments = segments.filter((segment) => !isRouteGroup(segment));
				pages.push({ pattern: `/${urlSegments.join("/")}`, inPanel: segments.includes(PANEL_GROUP) });
			}
			continue;
		}
		if (entry.isDirectory() && !entry.name.startsWith("_")) {
			collectPages(join(dir, entry.name), [...segments, entry.name], pages);
		}
	}
}

const PAGES: readonly DiscoveredPage[] = ((): readonly DiscoveredPage[] => {
	const pages: DiscoveredPage[] = [];
	collectPages(APP_DIR, [], pages);
	return pages;
})();

/** The reviewed access classification of one page. */
type ExpectedAccess =
	| { readonly kind: "public" }
	| { readonly kind: "open" }
	| { readonly kind: "super-admin" }
	| { readonly kind: "permissions"; readonly permissions: readonly CapabilitySlug[]; readonly mode: "any" | "all" };

const PUBLIC: ExpectedAccess = { kind: "public" };
const OPEN: ExpectedAccess = { kind: "open" };
const SUPER_ADMIN: ExpectedAccess = { kind: "super-admin" };

/** EVERY one of `permissions` is needed to open the page. */
function needsAll(...permissions: readonly CapabilitySlug[]): ExpectedAccess {
	return { kind: "permissions", permissions, mode: "all" };
}

/** Any ONE of `permissions` opens the page (the rule's default mode). */
function needs(...permissions: readonly CapabilitySlug[]): ExpectedAccess {
	return { kind: "permissions", permissions, mode: "any" };
}

/**
 * Every page → its access, mirroring the API route the page calls. Adding a
 * page fails the coverage test until it is classified here (and the rule
 * table agrees), so nothing ships silently unguarded.
 */
const EXPECTED_PAGE_ACCESS: ReadonlyMap<string, ExpectedAccess> = new Map<string, ExpectedAccess>([
	// Outside the panel: the sign-in flow.
	["/auth/login", PUBLIC],
	["/auth/forgot-password", PUBLIC],
	["/auth/reset-password", PUBLIC],
	["/auth/verify-email", PUBLIC],
	// Any signed-in admin: the overview, section redirects, personal account.
	["/", OPEN],
	["/account", OPEN],
	["/account/profile", OPEN],
	["/account/security", OPEN],
	["/analytics", OPEN],
	["/catalog", OPEN],
	["/emails", OPEN],
	["/rewards", OPEN],
	["/settings", OPEN],
	// @SuperAdminOnly API routes.
	["/users", SUPER_ADMIN],
	["/users/[id]", SUPER_ADMIN],
	["/users/mfa-recovery", SUPER_ADMIN],
	// @RequirePermission API routes.
	["/analytics/sales", needs(PERMISSION.ANALYTICS.READ)],
	["/catalog/products", needs(PERMISSION.PRODUCT.LIST)],
	["/catalog/products/new", needsAll(PERMISSION.PRODUCT.CREATE, PERMISSION.SAMPLE_CATEGORY.LIST, PERMISSION.SAMPLE_CATEGORY.READ)],
	["/catalog/products/[id]", needs(PERMISSION.PRODUCT.READ)],
	["/catalog/products/[id]/edit", needsAll(PERMISSION.PRODUCT.READ, PERMISSION.PRODUCT.UPDATE, PERMISSION.SAMPLE_CATEGORY.LIST, PERMISSION.SAMPLE_CATEGORY.READ)],
	["/catalog/categories", needs(PERMISSION.SAMPLE_CATEGORY.LIST)],
	["/catalog/categories/new", needs(PERMISSION.SAMPLE_CATEGORY.CREATE)],
	["/catalog/categories/[id]", needs(PERMISSION.SAMPLE_CATEGORY.READ)],
	["/catalog/categories/[id]/edit", needsAll(PERMISSION.SAMPLE_CATEGORY.READ, PERMISSION.SAMPLE_CATEGORY.UPDATE)],
	["/emails/templates", needs(PERMISSION.EMAIL.READ)],
	["/emails/log", needs(PERMISSION.EMAIL.LIST)],
	["/geography", needs(PERMISSION.GEO.READ)],
	["/merchants", needs(PERMISSION.MERCHANT_ORG.LIST)],
	["/merchants/invites", needs(PERMISSION.MERCHANT_ORG.MANAGE)],
	["/merchants/verification", needs(PERMISSION.MERCHANT_ORG.LIST)],
	["/merchants/store-requests", needs(PERMISSION.MERCHANT_ORG.LIST)],
	["/rewards/review", needs(PERMISSION.REWARD.MANAGE)],
	["/settings/access", needs(PERMISSION.ROLE.LIST, PERMISSION.PERMISSION.LIST, PERMISSION.PERMISSION.READ)],
]);

const SAMPLE_PARAM = "sample-id";

function describeRule(rule: RouteAuthorizationRule): ExpectedAccess {
	if (rule.superAdminOnly === true) {
		return SUPER_ADMIN;
	}
	if (isOpenRouteRule(rule) || rule.authorization === undefined) {
		return OPEN;
	}
	// The mode is part of the classification: an "all" rule where "any" was reviewed (or the reverse) must fail.
	return { kind: "permissions", permissions: rule.authorization.permissions, mode: rule.authorization.mode ?? "any" };
}

describe("describeRule", () => {
	it("tells an any-of rule from an all-of rule with the same permissions", () => {
		const permissions = [PERMISSION.ROLE.LIST, PERMISSION.PERMISSION.LIST];
		expect(describeRule({ prefix: "/x", authorization: { permissions, mode: "all" } })).not.toEqual(needs(...permissions));
		expect(describeRule({ prefix: "/x", authorization: { permissions } })).toEqual(needs(...permissions));
	});
});

describe("every admin page has an explicit access rule (guard)", () => {
	it("discovers the app's pages from disk", () => {
		expect(PAGES.length).toBeGreaterThan(20);
		expect(PAGES.map((page) => page.pattern)).toContain("/catalog/products/[id]/edit");
	});

	it("classifies every page, and lists no page that does not exist", () => {
		const discovered = PAGES.map((page) => page.pattern).sort();
		expect(discovered).toEqual([...EXPECTED_PAGE_ACCESS.keys()].sort());
	});

	it("resolves every panel page to a rule of the guard's table, exactly as classified", () => {
		for (const page of PAGES.filter((candidate) => candidate.inPanel)) {
			const rule = resolveRouteAuthorization(ADMIN_ROUTE_AUTHORIZATION, samplePathForPattern(page.pattern, SAMPLE_PARAM));
			expect(rule, `${page.pattern} has no rule`).not.toBeNull();
			if (rule !== null) {
				expect(describeRule(rule), page.pattern).toEqual(EXPECTED_PAGE_ACCESS.get(page.pattern));
			}
		}
	});

	it("keeps public pages outside the guarded panel, in the auth section only", () => {
		for (const page of PAGES) {
			const isPublic = EXPECTED_PAGE_ACCESS.get(page.pattern)?.kind === "public";
			expect(isPublic, page.pattern).toBe(!page.inPanel);
			if (isPublic) {
				expect(isPathWithin(page.pattern, AUTH_SECTION_PREFIX), page.pattern).toBe(true);
			}
		}
	});
});

interface SessionCase {
	readonly name: string;
	readonly capabilities: readonly CapabilitySlug[];
	readonly isSuperAdmin: boolean;
}

/** Every capability any rule asks for — one session per capability, plus none / all / super admin. */
const RULE_CAPABILITIES: readonly CapabilitySlug[] = [...new Set(ADMIN_ROUTE_AUTHORIZATION.flatMap((rule) => rule.authorization?.permissions ?? []))];

const SESSION_CASES: readonly SessionCase[] = [
	{ name: "no capabilities", capabilities: [], isSuperAdmin: false },
	{ name: "every rule capability", capabilities: RULE_CAPABILITIES, isSuperAdmin: false },
	{ name: "super admin without capabilities", capabilities: [], isSuperAdmin: true },
	...RULE_CAPABILITIES.map((capability): SessionCase => ({ name: capability, capabilities: [capability], isSuperAdmin: false })),
];

function routeSession(sessionCase: SessionCase): RouteAccessSession {
	const granted = createGrantedCapabilities(sessionCase.capabilities);
	return {
		isGranted: (permission: CapabilitySlug): boolean => isCapabilityGranted(granted, permission),
		enabledFeatureFlags: [],
		isSuperAdmin: sessionCase.isSuperAdmin,
	};
}

/** The menu exactly as `DashboardLayout` builds it for the session. */
function authorizedMenu(sessionCase: SessionCase): CompiledSidebarMenuData {
	return filterMenuByRouteAccess(
		filterCompiledSidebarMenu(SIDEBAR_MENU, sessionCase.capabilities, { enabledFeatureFlags: [] }),
		ADMIN_ROUTE_AUTHORIZATION,
		routeSession(sessionCase),
	);
}

function flatten(items: readonly CompiledSidebarMenuItem[]): readonly CompiledSidebarMenuItem[] {
	return items.flatMap((item) => [item, ...flatten(item.children ?? [])]);
}

function allItems(menu: CompiledSidebarMenuData): readonly CompiledSidebarMenuItem[] {
	return flatten([...menu.sections.flatMap((section) => section.items), ...menu.bottomItems]);
}

/** Enabled items that open a page (parents only expand their section). */
function enabledLeaves(menu: CompiledSidebarMenuData): readonly CompiledSidebarMenuItem[] {
	return allItems(menu).filter((item) => item.disabled !== true && item.url.startsWith("/") && (item.children === undefined || item.children.length === 0));
}

describe("sidebar and palette visibility ⇔ route guard (real menu)", () => {
	for (const sessionCase of SESSION_CASES) {
		it(`offers a page exactly when the guard renders it — ${sessionCase.name}`, () => {
			const session = routeSession(sessionCase);
			const menu = authorizedMenu(sessionCase);
			const visibleLeafUrls = new Set(enabledLeaves(menu).map((item) => item.url));

			for (const item of enabledLeaves(SIDEBAR_MENU)) {
				expect(visibleLeafUrls.has(item.url), `${item.title} (${item.url})`).toBe(canAccessRoute(ADMIN_ROUTE_AUTHORIZATION, item.url, session));
			}
			for (const entry of buildSearchableItems(menu)) {
				expect(canAccessRoute(ADMIN_ROUTE_AUTHORIZATION, entry.url, session), `palette → ${entry.title} (${entry.url})`).toBe(true);
			}
		});
	}

	it("hides a section parent whose every child page is denied", () => {
		const urls = allItems(authorizedMenu({ name: "none", capabilities: [], isSuperAdmin: false })).map((item) => item.url);
		expect(urls).not.toContain("/users");
		expect(urls).not.toContain("/users/roles");
	});
});
