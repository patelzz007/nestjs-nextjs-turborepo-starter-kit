import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import type { CompiledSidebarMenuData, CompiledSidebarMenuItem } from "@workspace/client/lib/sidebar/sidebar-menu-schema";
import { computeRouteState } from "@workspace/ui/lib/sidebar/menu-view";
import { withResolvedSidebarMenuUrls } from "@workspace/ui/lib/sidebar/resolve-menu-hrefs";
import { describe, expect, it } from "vitest";

import { MERCHANT_MENU_ICON_MAP } from "@/lib/navigation/menu-icons";
import { MERCHANT_NAV_ITEMS } from "@/lib/navigation/nav-items";
import { createMerchantNavHrefResolver } from "@/lib/navigation/resolve-nav-href";
import { MERCHANT_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { APP_STATIC_ROUTES, isPathWithin, ORG_STATIC_ROUTES, orgPath, orgRoutes, type AppPath } from "@/lib/routes";

const ORG_SLUG = "acme-coffee";
const SAMPLE_REWARD_ID = "3f1c2b8e-9a4d-4c3e-8b7a-1d2e3f4a5b6c";
const APP_DIR = fileURLToPath(new URL("../../app", import.meta.url));
const PAGE_FILE_NAME = "page.tsx";

/** A flattened menu node with the state that decides whether a user can reach it. */
interface FlatMenuItem {
	readonly item: CompiledSidebarMenuItem;
	readonly parent: CompiledSidebarMenuItem | undefined;
	/** Enabled itself and under enabled ancestors. */
	readonly isEnabled: boolean;
	/** A leaf navigates; a parent with children is a section toggle. */
	readonly isNavigable: boolean;
}

function flattenMenu(menu: CompiledSidebarMenuData): readonly FlatMenuItem[] {
	const rows: FlatMenuItem[] = [];
	const walk = (item: CompiledSidebarMenuItem, parent: CompiledSidebarMenuItem | undefined, parentEnabled: boolean): void => {
		const isEnabled = parentEnabled && item.disabled !== true;
		const children = item.children ?? [];
		rows.push({ item, parent, isEnabled, isNavigable: children.length === 0 });
		for (const child of children) {
			walk(child, item, isEnabled);
		}
	};
	for (const item of [...menu.sections.flatMap((section) => section.items), ...menu.bottomItems]) {
		walk(item, undefined, true);
	}
	return rows;
}

const RESOLVED_MENU: CompiledSidebarMenuData = withResolvedSidebarMenuUrls(MERCHANT_SIDEBAR_MENU, createMerchantNavHrefResolver(ORG_SLUG));
const RESOLVED_ITEMS: readonly CompiledSidebarMenuItem[] = [...RESOLVED_MENU.sections.flatMap((section) => section.items), ...RESOLVED_MENU.bottomItems];
const RESOLVED_ROWS: readonly FlatMenuItem[] = flattenMenu(RESOLVED_MENU);
const ENABLED_ROWS: readonly FlatMenuItem[] = RESOLVED_ROWS.filter((row) => row.isEnabled);

/** Route patterns (`/orgs/[orgSlug]/rewards/[rewardId]/edit`) for every `app/**\/page.tsx`. */
function collectPageRoutePatterns(directory: string): readonly (readonly string[])[] {
	const patterns: (readonly string[])[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const entryPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			patterns.push(...collectPageRoutePatterns(entryPath));
			continue;
		}
		if (entry.name !== PAGE_FILE_NAME) {
			continue;
		}
		const routeDirectory = relative(APP_DIR, directory);
		const segments = routeDirectory.length === 0 ? [] : routeDirectory.split(sep);
		// Route groups `(group)` and parallel slots `@slot` never appear in the URL.
		patterns.push(segments.filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")) && !segment.startsWith("@")));
	}
	return patterns;
}

const PAGE_PATTERNS: readonly (readonly string[])[] = collectPageRoutePatterns(APP_DIR);

function isDynamicSegment(segment: string): boolean {
	return segment.startsWith("[") && segment.endsWith("]");
}

function isCatchAllSegment(segment: string): boolean {
	return segment.startsWith("[...") || segment.startsWith("[[...");
}

function patternMatches(pattern: readonly string[], segments: readonly string[]): boolean {
	for (const [index, part] of pattern.entries()) {
		if (isCatchAllSegment(part)) {
			return segments.length > index || part.startsWith("[[...");
		}
		const segment = segments.at(index);
		if (segment === undefined) {
			return false;
		}
		if (!isDynamicSegment(part) && part !== segment) {
			return false;
		}
	}
	return pattern.length === segments.length;
}

function hasPage(pathname: string): boolean {
	const segments = pathname.split("/").filter((segment) => segment.length > 0);
	return PAGE_PATTERNS.some((pattern) => patternMatches(pattern, segments));
}

function activeIdsFor(pathname: string): readonly string[] {
	const { activeItems } = computeRouteState(RESOLVED_ITEMS, pathname);
	return Object.keys(activeItems).filter((id) => activeItems[id] === true);
}

function idOfUrl(url: string): string | undefined {
	return ENABLED_ROWS.find((row) => row.isNavigable && row.item.url === url)?.item.id;
}

describe("merchant route table ↔ app/ pages", () => {
	it("discovers the page files it guards", () => {
		expect(PAGE_PATTERNS.length).toBeGreaterThan(0);
		expect(hasPage("/orgs/any-org/rewards/any-id/edit")).toBe(true);
		expect(hasPage("/orgs/any-org/rewards/any-id")).toBe(false);
	});

	it.each(APP_STATIC_ROUTES)("top-level route %s has a page", (route: string): void => {
		expect(hasPage(route)).toBe(true);
	});

	it.each(ORG_STATIC_ROUTES)("org route %s has a page under /orgs/[orgSlug]", (route: AppPath): void => {
		expect(hasPage(orgPath(ORG_SLUG, route))).toBe(true);
	});

	it("has a page for the dynamic reward edit route and the org root", () => {
		expect(hasPage(orgRoutes(ORG_SLUG).rewards.edit(SAMPLE_REWARD_ID))).toBe(true);
		expect(hasPage(orgRoutes(ORG_SLUG).root)).toBe(true);
	});

	it("removed the legacy top-level redirect stubs (hard cut)", () => {
		const legacyPaths: readonly string[] = [
			"/analytics",
			"/api-keys",
			"/redemptions",
			"/rewards",
			"/rewards/new",
			"/rewards/some-id",
			"/settings",
			"/settings/team",
			"/settings/verification",
		];
		expect(legacyPaths.filter(hasPage)).toEqual([]);
	});

	it.each(MERCHANT_NAV_ITEMS.map((item) => item.url))("palette entry %s resolves to an existing page", (url: string): void => {
		expect(hasPage(createMerchantNavHrefResolver(ORG_SLUG)(url))).toBe(true);
	});
});

describe("merchant sidebar menu", () => {
	it("every enabled item (after org resolution) points at an existing page", () => {
		const missing = ENABLED_ROWS.filter((row) => !hasPage(row.item.url)).map((row) => `${row.item.title} → ${row.item.url}`);
		expect(missing).toEqual([]);
	});

	it("every menu URL is an app path, not a placeholder or a bare subpath", () => {
		const raw = flattenMenu(MERCHANT_SIDEBAR_MENU);
		expect(raw.filter((row) => !row.item.url.startsWith("/")).map((row) => row.item.title)).toEqual([]);
		expect(raw.filter((row) => row.item.url.startsWith("/orgs/")).map((row) => row.item.title)).toEqual([]);
	});

	it("no two enabled navigable items share a URL", () => {
		const urls = ENABLED_ROWS.filter((row) => row.isNavigable).map((row) => row.item.url);
		expect(urls.filter((url, index) => urls.indexOf(url) !== index)).toEqual([]);
	});

	it("no two enabled section parents share a URL", () => {
		const urls = ENABLED_ROWS.filter((row) => !row.isNavigable).map((row) => row.item.url);
		expect(urls.filter((url, index) => urls.indexOf(url) !== index)).toEqual([]);
	});

	it("every child URL sits under its parent's URL (segment-aware)", () => {
		const strays = RESOLVED_ROWS.filter((row) => row.parent !== undefined && !isPathWithin(row.item.url, row.parent.url)).map(
			(row) => `${row.item.title} (${row.item.url}) ∉ ${row.parent?.url ?? ""}`,
		);
		expect(strays).toEqual([]);
	});

	it("every icon name is registered", () => {
		const unknownIcons = flattenMenu(MERCHANT_SIDEBAR_MENU)
			.map((row) => row.item.icon)
			.filter((icon): icon is string => icon !== undefined && MERCHANT_MENU_ICON_MAP[icon] === undefined);
		expect(unknownIcons).toEqual([]);
	});
});

describe("merchant sidebar active state (real menu + resolver + shared algorithm)", () => {
	const routes = orgRoutes(ORG_SLUG);

	it("lights exactly one item on the redemptions page", () => {
		expect(activeIdsFor(routes.redemptions)).toEqual([idOfUrl(routes.redemptions)]);
	});

	it("lights the rewards list item on a reward edit page and expands My Rewards", () => {
		const state = computeRouteState(RESOLVED_ITEMS, routes.rewards.edit(SAMPLE_REWARD_ID));
		expect(activeIdsFor(routes.rewards.edit(SAMPLE_REWARD_ID))).toEqual([idOfUrl(routes.rewards.list)]);
		expect(state.autoExpandedItems).toEqual({ "rewards-my-rewards": true });
	});

	it("lights Create New (not All Rewards) on the create-reward page", () => {
		expect(activeIdsFor(routes.rewards.new)).toEqual([idOfUrl(routes.rewards.new)]);
	});

	it("lights Settings → Team on the team page", () => {
		expect(activeIdsFor(routes.settings.team)).toEqual(["settings-team"]);
	});

	it("lights Settings → Overview on the organization settings index", () => {
		expect(activeIdsFor(routes.settings.index)).toEqual(["settings-overview"]);
	});

	it("lights Account on the personal account page", () => {
		expect(activeIdsFor(routes.account)).toEqual(["account"]);
	});

	it("lights Dashboard on the dashboard", () => {
		expect(activeIdsFor(routes.dashboard)).toEqual(["overview-dashboard"]);
	});

	it.each(ORG_STATIC_ROUTES)("never lights more than one item on %s", (route: AppPath): void => {
		expect(activeIdsFor(orgPath(ORG_SLUG, route)).length).toBeLessThanOrEqual(1);
	});
});
