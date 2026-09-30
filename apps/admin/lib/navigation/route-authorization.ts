import { evaluateSidebarAuthorization } from "@workspace/client/lib/navigation/filter-sidebar-menu-by-capabilities";
import { SidebarFeatureFlagSchema } from "@workspace/client/lib/sidebar/sidebar-menu-schema";
import type { CompiledSidebarMenuData, CompiledSidebarMenuItem } from "@workspace/client/lib/sidebar/sidebar-menu-schema";
import { PERMISSION, type CapabilitySlug } from "@workspace/shared";
import { z } from "zod";

import { isRouteActive } from "@/lib/navigation/menu";
import { SidebarAuthorizationSchema, type SidebarAuthorization, type SidebarMenuData, type SidebarMenuItem } from "@/lib/navigation/sidebar";
import { SIDEBAR_MENU_DATA } from "@/lib/navigation/sidebar-menu";

/**
 * Requirement for every pathname under `prefix` (segment-aware). A rule with
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

		if (item.url.startsWith("/")) {
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

/** Longest segment-aware prefix match; `null` when no rule covers `pathname`. */
export function resolveRouteAuthorization(rules: readonly RouteAuthorizationRule[], pathname: string): RouteAuthorizationRule | null {
	let best: RouteAuthorizationRule | null = null;
	for (const rule of rules) {
		if (!isRouteActive(rule.prefix, pathname)) {
			continue;
		}
		if (best === null || rule.prefix.length > best.prefix.length) {
			best = rule;
		}
	}
	return best;
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
	// GET /auth/admin/users + /auth/admin/users/:userId — @SuperAdminOnly
	{ prefix: "/users", superAdminOnly: true },
	{ prefix: "/users/all", superAdminOnly: true },
	{ prefix: "/rewardhub/users", superAdminOnly: true },
	// GET /auth/admin/mfa/recovery/requests — @SuperAdminOnly
	{ prefix: "/settings/security/mfa-recovery", superAdminOnly: true },
	// GET /notifications/email-preview (READ EMAIL)
	{ prefix: "/admin/email-template", authorization: { permissions: [PERMISSION.EMAIL.READ] } },
	// POST /product, POST /sample-category (CREATE)
	{ prefix: "/product/create", authorization: { permissions: [PERMISSION.PRODUCT.CREATE] } },
	{ prefix: "/sample-category/create", authorization: { permissions: [PERMISSION.SAMPLE_CATEGORY.CREATE] } },
];

/** Admin route → requirement map. UX only — the API remains authoritative. */
export const ADMIN_ROUTE_AUTHORIZATION: readonly RouteAuthorizationRule[] = buildRouteAuthorizationRules(SIDEBAR_MENU_DATA, EXPLICIT_ROUTE_RULES);

function isSuperAdminOnlyItem(rules: readonly RouteAuthorizationRule[], item: CompiledSidebarMenuItem): boolean {
	return item.url.startsWith("/") && resolveRouteAuthorization(rules, item.url)?.superAdminOnly === true;
}

function hideSuperAdminOnlyItems(rules: readonly RouteAuthorizationRule[], items: readonly CompiledSidebarMenuItem[]): CompiledSidebarMenuItem[] {
	const visible: CompiledSidebarMenuItem[] = [];
	for (const item of items) {
		if (isSuperAdminOnlyItem(rules, item)) {
			continue;
		}
		if (item.children === undefined) {
			visible.push(item);
			continue;
		}
		const children = hideSuperAdminOnlyItems(rules, item.children);
		// A structural parent whose children were all super-admin pages would render empty.
		if (children.length === 0 && item.children.length > 0) {
			continue;
		}
		visible.push({ ...item, children });
	}
	return visible;
}

/**
 * Removes menu items that lead to `superAdminOnly` routes (with their subtree)
 * for sessions without the super-admin flag; the capability filter cannot see
 * that flag. Returns `menu` unchanged for super admins.
 */
export function filterSuperAdminOnlyMenu(menu: CompiledSidebarMenuData, rules: readonly RouteAuthorizationRule[], isSuperAdmin: boolean): CompiledSidebarMenuData {
	if (isSuperAdmin) {
		return menu;
	}
	const sections = menu.sections.map((section) => ({ ...section, items: hideSuperAdminOnlyItems(rules, section.items) })).filter((section) => section.items.length > 0);
	return {
		header: menu.header,
		sections,
		bottomItems: hideSuperAdminOnlyItems(rules, menu.bottomItems),
	};
}
