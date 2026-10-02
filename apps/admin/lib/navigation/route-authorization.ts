import { evaluateSidebarAuthorization } from "@workspace/client/lib/navigation/filter-sidebar-menu-by-capabilities";
import { SidebarFeatureFlagSchema } from "@workspace/client/lib/sidebar/sidebar-menu-schema";
import type { CompiledSidebarMenuData, CompiledSidebarMenuItem } from "@workspace/client/lib/sidebar/sidebar-menu-schema";
import { PERMISSION, type CapabilitySlug } from "@workspace/shared";
import { findMostSpecificRoute } from "@workspace/ui/lib/sidebar/navigation/route-patterns";
import { z } from "zod";

import { SidebarAuthorizationSchema, type SidebarAuthorization, type SidebarMenuData, type SidebarMenuItem } from "@/lib/navigation/sidebar";
import { SIDEBAR_MENU_DATA } from "@/lib/navigation/sidebar-menu";
import { ROUTE_PATTERNS, ROUTES } from "@/lib/routes";

/**
 * Requirement for every pathname under `prefix` (segment-aware). `prefix` may
 * contain dynamic segments in App Router notation (`/catalog/products/[id]`),
 * so a resource's detail and edit pages can carry their own rule. A rule with
 * no `authorization`, `featureFlag`, or `superAdminOnly` is an explicit
 * "open" entry — it shadows a gated ancestor so child routes stay reachable,
 * mirroring the menu filter (a gated parent survives when a visible child
 * survives). `superAdminOnly` mirrors `@SuperAdminOnly` API routes, which
 * carry no capability slug.
 */
export const RouteAuthorizationRuleSchema = z
	.object({
		prefix: z.string().startsWith("/"),
		authorization: SidebarAuthorizationSchema.optional(),
		featureFlag: SidebarFeatureFlagSchema.optional(),
		superAdminOnly: z.boolean().optional(),
	})
	.strict();

export type RouteAuthorizationRule = z.output<typeof RouteAuthorizationRuleSchema>;

interface InheritedRequirement {
	readonly cascade: SidebarAuthorization | undefined;
	readonly featureFlag: string | undefined;
}

function collectItemRules(items: readonly SidebarMenuItem[], inherited: InheritedRequirement, rules: Map<string, RouteAuthorizationRule>): void {
	for (const item of items) {
		const authorization = item.authorization ?? inherited.cascade;
		// A flag hides the whole subtree in the menu, so it gates every descendant route too.
		const featureFlag = item.featureFlag ?? inherited.featureFlag;

		// A disabled item has no page ("switched off"), so it gets no rule of its
		// own: an open rule there would shadow a gated ancestor (`/users/roles`
		// under the super-admin-only `/users`).
		if (item.url.startsWith("/") && item.disabled !== true) {
			rules.set(item.url, { prefix: item.url, authorization, featureFlag });
		}

		if (item.children !== undefined) {
			const cascade = authorization?.cascade === true ? authorization : undefined;
			collectItemRules(item.children, { cascade, featureFlag }, rules);
		}
	}
}

/**
 * Derives route rules from the menu config (deeper items override a parent
 * that shares their URL) and applies `explicit` entries last so they win.
 */
export function buildRouteAuthorizationRules(menu: SidebarMenuData, explicit: readonly RouteAuthorizationRule[]): readonly RouteAuthorizationRule[] {
	const rules = new Map<string, RouteAuthorizationRule>();
	const root: InheritedRequirement = { cascade: undefined, featureFlag: undefined };
	for (const section of menu.sections) {
		collectItemRules(section.items, root, rules);
	}
	collectItemRules(menu.bottomItems, root, rules);
	for (const rule of explicit) {
		rules.set(rule.prefix, rule);
	}
	return [...rules.values()];
}

/**
 * Most specific segment-aware prefix match — the deepest rule wins, and a
 * literal segment beats a dynamic one (`/x/new` over `/x/[id]`); `/` covers
 * only `/`. `null` when no rule covers `pathname`.
 */
export function resolveRouteAuthorization(rules: readonly RouteAuthorizationRule[], pathname: string): RouteAuthorizationRule | null {
	return findMostSpecificRoute(rules, (rule) => rule.prefix, pathname, "prefix");
}

/** True when the rule gates nothing (an "open" entry). */
export function isOpenRouteRule(rule: RouteAuthorizationRule): boolean {
	return rule.authorization === undefined && rule.featureFlag === undefined && rule.superAdminOnly !== true;
}

/**
 * True when the rule's feature is enabled AND its permission requirement is
 * met AND (for `superAdminOnly` rules) the session is a super admin. Fails
 * closed: callers that omit `isSuperAdmin` never pass a super-admin rule.
 */
export function isRouteRuleSatisfied(
	rule: RouteAuthorizationRule,
	isGranted: (permission: CapabilitySlug) => boolean,
	enabledFeatureFlags: readonly string[],
	isSuperAdmin = false,
): boolean {
	if (rule.featureFlag !== undefined && !enabledFeatureFlags.includes(rule.featureFlag)) {
		return false;
	}
	if (rule.superAdminOnly === true && !isSuperAdmin) {
		return false;
	}
	if (rule.authorization === undefined) {
		return true;
	}
	return evaluateSidebarAuthorization(rule.authorization, isGranted);
}

/**
 * Routes gated outside the sidebar config: sub-pages without a menu entry and
 * `@SuperAdminOnly` pages. Each mirrors the API route the page calls.
 */
const EXPLICIT_ROUTE_RULES: readonly RouteAuthorizationRule[] = [
	// GET /auth/admin/users + /auth/admin/users/:userId — @SuperAdminOnly.
	// Covers the list, every `/users/[id]` detail page, and the queue below.
	{ prefix: ROUTES.users.list, superAdminOnly: true },
	// GET /auth/admin/mfa/recovery/requests — @SuperAdminOnly
	{ prefix: ROUTES.users.mfaRecovery, superAdminOnly: true },
	// POST /product, POST /sample-category (CREATE)
	{ prefix: ROUTES.catalog.products.create, authorization: { permissions: [PERMISSION.PRODUCT.CREATE] } },
	{ prefix: ROUTES.catalog.categories.create, authorization: { permissions: [PERMISSION.SAMPLE_CATEGORY.CREATE] } },
	// GET /product/:id, GET /sample-category/:id (READ)
	{ prefix: ROUTE_PATTERNS.catalog.products.detail, authorization: { permissions: [PERMISSION.PRODUCT.READ] } },
	{ prefix: ROUTE_PATTERNS.catalog.categories.detail, authorization: { permissions: [PERMISSION.SAMPLE_CATEGORY.READ] } },
	// PATCH /product/:id, PATCH /sample-category/:id (UPDATE)
	{ prefix: ROUTE_PATTERNS.catalog.products.edit, authorization: { permissions: [PERMISSION.PRODUCT.UPDATE] } },
	{ prefix: ROUTE_PATTERNS.catalog.categories.edit, authorization: { permissions: [PERMISSION.SAMPLE_CATEGORY.UPDATE] } },
];

/** Admin route → requirement map. UX only — the API remains authoritative. */
export const ADMIN_ROUTE_AUTHORIZATION: readonly RouteAuthorizationRule[] = buildRouteAuthorizationRules(SIDEBAR_MENU_DATA, EXPLICIT_ROUTE_RULES);

/** The session facts a route rule is evaluated against. */
export interface RouteAccessSession {
	readonly isGranted: (permission: CapabilitySlug) => boolean;
	readonly enabledFeatureFlags: readonly string[];
	readonly isSuperAdmin: boolean;
}

/**
 * True when `session` may open `href`: the governing rule is satisfied, or no
 * rule covers it. The same check the route guard renders with, so anything
 * offering a link (palette quick action, topbar) can ask before showing it.
 */
export function canAccessRoute(rules: readonly RouteAuthorizationRule[], href: string, session: RouteAccessSession): boolean {
	const rule = resolveRouteAuthorization(rules, href);
	return rule === null || isRouteRuleSatisfied(rule, session.isGranted, session.enabledFeatureFlags, session.isSuperAdmin);
}

function isNavigableUrl(url: string): boolean {
	return url.startsWith("/");
}

function filterItemsByRouteAccess(
	rules: readonly RouteAuthorizationRule[],
	items: readonly CompiledSidebarMenuItem[],
	session: RouteAccessSession,
): CompiledSidebarMenuItem[] {
	const visible: CompiledSidebarMenuItem[] = [];
	for (const item of items) {
		const allowed = !isNavigableUrl(item.url) || canAccessRoute(rules, item.url, session);
		if (item.children === undefined) {
			if (allowed) {
				visible.push(item);
			}
			continue;
		}
		const children = filterItemsByRouteAccess(rules, item.children, session);
		// A section parent only expands its children: it survives through a
		// visible child, or as a leaf when its own page is allowed and it had
		// no children to begin with. A parent whose children were all hidden
		// would render empty, so it goes too.
		if (children.length === 0 && item.children.length > 0) {
			continue;
		}
		if (!allowed && children.length === 0) {
			continue;
		}
		visible.push({ ...item, children });
	}
	return visible;
}

/**
 * Removes every menu item whose page the route guard would deny — capability,
 * feature flag, and `superAdminOnly` (which the capability filter cannot see)
 * — so a visible item always opens. Run it on the capability-filtered menu:
 * the sidebar, the command palette and the pinned items all read the result.
 */
export function filterMenuByRouteAccess(menu: CompiledSidebarMenuData, rules: readonly RouteAuthorizationRule[], session: RouteAccessSession): CompiledSidebarMenuData {
	const sections = menu.sections
		.map((section) => ({ ...section, items: filterItemsByRouteAccess(rules, section.items, session) }))
		.filter((section) => section.items.length > 0);
	return {
		header: menu.header,
		sections,
		bottomItems: filterItemsByRouteAccess(rules, menu.bottomItems, session),
	};
}
