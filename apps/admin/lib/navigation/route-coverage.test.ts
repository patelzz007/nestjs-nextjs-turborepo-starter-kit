/**
 * Guard tests for the admin URL structure (lib/routes.ts + sidebar-menu.json).
 * They keep the sidebar, the typed routes module, and the `app/` pages from
 * drifting apart:
 *
 * 1. every enabled menu URL and every `ROUTES` path is a real page,
 * 2. no two enabled menu items share a URL (a section's own index child is the
 *    single sanctioned exception — see `isSectionIndexChild`),
 * 3. every child URL sits under its parent's URL, so the parent prefix-matches it,
 * 4. the real active-route algorithm highlights the intended item on real pages.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { computeRouteState } from "@workspace/ui/lib/sidebar/menu-view";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import type { CompiledSidebarMenuItem, SidebarMenuItem } from "@/lib/navigation/sidebar";
import { SIDEBAR_MENU, SIDEBAR_MENU_DATA } from "@/lib/navigation/sidebar-menu";
import { isPathWithin, ROUTES, type RouteBuilder } from "@/lib/routes";

const APP_DIR: string = fileURLToPath(new URL("../../app", import.meta.url));

/** A page route as path segments; `null` marks a dynamic `[param]` segment. */
type RoutePattern = readonly (string | null)[];

function isRouteGroup(segment: string): boolean {
	return segment.startsWith("(") || segment.startsWith("@");
}

function isCatchAll(segment: string): boolean {
	return segment.startsWith("[...") || segment.startsWith("[[...");
}

/** Every `page.tsx` under `app/`, minus catch-alls (they match anything, so they prove nothing). */
function collectPagePatterns(dir: string, segments: readonly string[], patterns: RoutePattern[]): void {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isFile() && entry.name === "page.tsx") {
			if (!segments.some(isCatchAll)) {
				patterns.push(segments.filter((segment) => !isRouteGroup(segment)).map((segment) => (segment.startsWith("[") ? null : segment)));
			}
			continue;
		}
		// `_folder` is a private (non-route) folder; `__tests__` falls under it too.
		if (entry.isDirectory() && !entry.name.startsWith("_")) {
			collectPagePatterns(join(dir, entry.name), [...segments, entry.name], patterns);
		}
	}
}

const PAGE_PATTERNS: readonly RoutePattern[] = ((): readonly RoutePattern[] => {
	const patterns: RoutePattern[] = [];
	collectPagePatterns(APP_DIR, [], patterns);
	return patterns;
})();

function pathSegments(pathname: string): readonly string[] {
	return pathname.split("/").filter((segment) => segment.length > 0);
}

function matchesPattern(pattern: RoutePattern, segments: readonly string[]): boolean {
	return pattern.length === segments.length && pattern.every((expected, index) => expected === null || expected === segments[index]);
}

/** True when `href` (path + optional query) is served by a non-catch-all page. */
function hasPage(href: string): boolean {
	const segments = pathSegments(new URL(href, "http://admin.test").pathname);
	return PAGE_PATTERNS.some((pattern) => matchesPattern(pattern, segments));
}

interface MenuEntry {
	readonly item: SidebarMenuItem;
	readonly parent: SidebarMenuItem | null;
}

function collectMenuEntries(items: readonly SidebarMenuItem[], parent: SidebarMenuItem | null, entries: MenuEntry[]): void {
	for (const item of items) {
		entries.push({ item, parent });
		if (item.children !== undefined) {
			collectMenuEntries(item.children, item, entries);
		}
	}
}

const MENU_ENTRIES: readonly MenuEntry[] = ((): readonly MenuEntry[] => {
	const entries: MenuEntry[] = [];
	for (const section of SIDEBAR_MENU_DATA.sections) {
		collectMenuEntries(section.items, null, entries);
	}
	collectMenuEntries(SIDEBAR_MENU_DATA.bottomItems, null, entries);
	return entries;
})();

const ENABLED_ENTRIES: readonly MenuEntry[] = MENU_ENTRIES.filter((entry) => entry.item.disabled !== true && entry.item.url.startsWith("/"));

/**
 * A section whose index page IS its list (`/users`, `/merchants`) needs a
 * child that links to that list ("All users"), and a section's URL is its
 * prefix — so that one child shares the parent's URL. The parent is a
 * toggle-only row (it never navigates), and the active-route algorithm lets
 * the deeper child win the tie, so only the child ever highlights.
 */
function isSectionIndexChild(entry: MenuEntry): boolean {
	return entry.parent !== null && entry.parent.url === entry.item.url;
}

interface StaticRoute {
	readonly name: string;
	readonly href: string;
}

const SAMPLE_PARAM = "sample-id";

/** A node of the `ROUTES` tree: a static path, a path builder, or a nested group. */
type RouteNode = string | RouteBuilder | RouteGroup;

interface RouteGroup {
	readonly [name: string]: RouteNode;
}

const RouteBuilderSchema = z.custom<RouteBuilder>((value) => typeof value === "function", { message: "Expected a route builder function" });

/** Parses `ROUTES` generically, so a route added to it is covered without editing this test. */
const RouteGroupSchema: z.ZodType<RouteGroup> = z.lazy(() => z.record(z.string(), z.union([z.string(), RouteBuilderSchema, RouteGroupSchema])));

/** Every static path in the tree, plus each builder applied to a sample value. */
function collectRoutes(group: RouteGroup, prefix: string, routes: StaticRoute[]): void {
	for (const [key, node] of Object.entries(group)) {
		const name = prefix.length > 0 ? `${prefix}.${key}` : key;
		const asPath = z.string().safeParse(node);
		if (asPath.success) {
			routes.push({ name, href: asPath.data });
			continue;
		}
		const asBuilder = RouteBuilderSchema.safeParse(node);
		if (asBuilder.success) {
			routes.push({ name: `${name}(${SAMPLE_PARAM})`, href: asBuilder.data(SAMPLE_PARAM) });
			continue;
		}
		collectRoutes(RouteGroupSchema.parse(node), name, routes);
	}
}

const ALL_ROUTES: readonly StaticRoute[] = ((): readonly StaticRoute[] => {
	const routes: StaticRoute[] = [];
	collectRoutes(RouteGroupSchema.parse(ROUTES), "", routes);
	return routes;
})();

describe("route coverage (guard)", () => {
	it("discovers the app's pages and ignores the panel catch-all", () => {
		expect(PAGE_PATTERNS.length).toBeGreaterThan(10);
		expect(hasPage("/definitely/not/a/page")).toBe(false);
		expect(hasPage("/users/42")).toBe(true);
	});

	it("every enabled sidebar URL is an existing page", () => {
		for (const { item } of ENABLED_ENTRIES) {
			expect(hasPage(item.url), `${item.title} → ${item.url}`).toBe(true);
		}
	});

	it("every ROUTES path (and every builder's output) is an existing page", () => {
		expect(ALL_ROUTES.length).toBeGreaterThan(20);
		for (const route of ALL_ROUTES) {
			expect(hasPage(route.href), `ROUTES.${route.name} → ${route.href}`).toBe(true);
		}
	});

	it("no two enabled menu items share a URL (except a section's own index child)", () => {
		const owners = new Map<string, string>();
		for (const entry of ENABLED_ENTRIES) {
			if (isSectionIndexChild(entry)) {
				continue;
			}
			const existing = owners.get(entry.item.url);
			expect(existing, `${entry.item.title} duplicates ${existing ?? ""} at ${entry.item.url}`).toBeUndefined();
			owners.set(entry.item.url, entry.item.title);
		}
	});

	it("a section has at most one index child, and it is a leaf", () => {
		for (const entry of MENU_ENTRIES) {
			const indexChildren = (entry.item.children ?? []).filter((child) => child.url === entry.item.url);
			expect(indexChildren.length, entry.item.title).toBeLessThanOrEqual(1);
			for (const child of indexChildren) {
				expect(child.children, child.title).toBeUndefined();
			}
		}
	});

	it("every child URL sits under its parent's URL (segment-aware)", () => {
		for (const { item, parent } of MENU_ENTRIES) {
			if (parent !== null) {
				expect(isPathWithin(parent.url, item.url), `${parent.title} (${parent.url}) → ${item.title} (${item.url})`).toBe(true);
			}
		}
	});
});

function compiledItems(): readonly CompiledSidebarMenuItem[] {
	return [...SIDEBAR_MENU.sections.flatMap((section) => section.items), ...SIDEBAR_MENU.bottomItems];
}

/** Compiled id of the item reached by following `titles` from the menu root. */
function idOf(titles: readonly string[]): string {
	let level: readonly CompiledSidebarMenuItem[] = compiledItems();
	let found: CompiledSidebarMenuItem | undefined;
	for (const title of titles) {
		found = level.find((item) => item.title === title);
		if (found === undefined) {
			throw new Error(`No menu item at ${titles.join(" → ")}`);
		}
		level = found.children ?? [];
	}
	if (found === undefined) {
		throw new Error("Empty title path");
	}
	return found.id;
}

function activeIds(pathname: string): readonly string[] {
	const { activeItems } = computeRouteState(compiledItems(), pathname);
	return Object.keys(activeItems).filter((id) => activeItems[id] === true);
}

interface ActiveCase {
	readonly pathname: string;
	readonly expected: readonly string[];
}

const ACTIVE_CASES: readonly ActiveCase[] = [
	{ pathname: "/", expected: ["Overview"] },
	{ pathname: "/analytics/sales", expected: ["Analytics", "Sales"] },
	{ pathname: "/users", expected: ["Users", "All users"] },
	{ pathname: "/users/123", expected: ["Users", "All users"] },
	{ pathname: "/users/mfa-recovery", expected: ["Users", "MFA recovery"] },
	{ pathname: "/merchants", expected: ["Merchants", "All merchants"] },
	{ pathname: "/merchants/invites", expected: ["Merchants", "Invites"] },
	{ pathname: "/merchants/verification", expected: ["Merchants", "Verification"] },
	{ pathname: "/merchants/store-requests", expected: ["Merchants", "Store requests"] },
	{ pathname: "/rewards/review", expected: ["Rewards", "Review"] },
	{ pathname: "/emails/templates", expected: ["Emails", "Templates"] },
	{ pathname: "/emails/log", expected: ["Emails", "Log"] },
	{ pathname: "/geography", expected: ["Geography"] },
	{ pathname: "/catalog/products", expected: ["Catalog", "Products"] },
	{ pathname: "/catalog/products/new", expected: ["Catalog", "Products"] },
	{ pathname: "/catalog/products/42/edit", expected: ["Catalog", "Products"] },
	{ pathname: "/catalog/categories/7", expected: ["Catalog", "Categories"] },
	{ pathname: "/settings/billing", expected: ["Settings", "Billing"] },
	{ pathname: "/settings/access", expected: ["Settings", "Access control"] },
	{ pathname: "/account/profile", expected: ["Account", "Profile"] },
	{ pathname: "/account/security", expected: ["Account", "Security"] },
];

describe("sidebar active state on real pages (guard)", () => {
	for (const { pathname, expected } of ACTIVE_CASES) {
		it(`${pathname} highlights only ${expected.join(" → ")}`, () => {
			expect(activeIds(pathname)).toEqual([idOf(expected)]);
		});
	}

	it("auto-expands the section of an active child, without highlighting it", () => {
		const { activeItems, autoExpandedItems } = computeRouteState(compiledItems(), "/merchants/verification");
		expect(autoExpandedItems[idOf(["Merchants"])]).toBe(true);
		expect(activeItems[idOf(["Merchants"])]).toBeUndefined();
	});

	it("does not highlight anything for a URL outside every section", () => {
		expect(activeIds("/merchantsx")).toEqual([]);
		expect(activeIds("/rewardhub/pending")).toEqual([]);
	});
});
