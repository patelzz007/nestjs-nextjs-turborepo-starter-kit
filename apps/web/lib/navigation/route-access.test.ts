import { createGrantedCapabilities, isCapabilityGranted } from "@workspace/client/lib/auth/permission-check";
import { filterCompiledSidebarMenu } from "@workspace/client/lib/navigation/filter-sidebar-menu-by-capabilities";
import { compileMenu } from "@workspace/client/lib/sidebar/sidebar-menu-compile";
import type { CompiledSidebarMenuData, CompiledSidebarMenuItem, SidebarMenuData } from "@workspace/client/lib/sidebar/sidebar-menu-schema";
import { LIST_SLOT_INDEX, PERMISSION, type CapabilitySlug } from "@workspace/shared";
import { samplePathForPattern } from "@workspace/ui/lib/sidebar/navigation/route-patterns";
import { describe, expect, it } from "vitest";

import { isWebAuthPath, isWebProtectedPath, isWebTokenAuthPath } from "@/lib/auth/routes";
import {
	applyWebRouteAuthorization,
	canAccessWebPath,
	isWebRouteAllowed,
	resolveWebRouteAccess,
	resolveWebTrailPage,
	WEB_ROUTE_ACCESS,
	type WebRouteAccessRule,
	type WebRouteAudience,
	type WebRouteSession,
} from "@/lib/navigation/route-access";
import { USER_SIDEBAR_MENU } from "@/lib/navigation/sidebar-menu";
import { accessiblePaletteItems, WEB_PALETTE_ITEMS } from "@/lib/palette/nav-items";
import { isPathWithin, publicRewardDetailPath, rewardDetailPath, ROUTE_PREFIXES, ROUTES, walletClaimPath } from "@/lib/routes";
import { listAppPageRoutes } from "@/test-support/app-routes";

const SAMPLE_PARAM = "sample-id";

function session(isAuthenticated: boolean, capabilities: readonly CapabilitySlug[] = []): WebRouteSession {
	const granted = createGrantedCapabilities(capabilities);
	return { isAuthenticated, isGranted: (permission: CapabilitySlug): boolean => isCapabilityGranted(granted, permission) };
}

const GUEST: WebRouteSession = session(false);
const MEMBER: WebRouteSession = session(true);

/** Every `app/**\/page.tsx` as a pattern string in App Router notation (`/` for the root). */
const PAGE_PATTERNS: readonly string[] = listAppPageRoutes().map((segments) => `/${segments.join("/")}`);

/** The audience `proxy.ts` enforces for a concrete path. */
function proxyAudience(pathname: string): WebRouteAudience {
	if (isWebProtectedPath(pathname)) {
		return "signed-in";
	}
	if (isWebAuthPath(pathname) && !isWebTokenAuthPath(pathname)) {
		return "guest";
	}
	return "public";
}

describe("WEB_ROUTE_ACCESS coverage (guard)", () => {
	it("discovers the app's pages from disk", () => {
		expect(PAGE_PATTERNS.length).toBeGreaterThan(10);
		expect(PAGE_PATTERNS).toContain("/rewardhub/wallet/[claimId]");
	});

	it("gives every page an explicit access rule, so a new page cannot be added unclassified", () => {
		const patterns = new Set(WEB_ROUTE_ACCESS.map((rule) => rule.pattern));
		const unclassified = PAGE_PATTERNS.filter((pattern) => !patterns.has(pattern));

		expect(unclassified).toEqual([]);
	});

	it("has no rule without a page and no page listed twice", () => {
		const patterns = WEB_ROUTE_ACCESS.map((rule) => rule.pattern);

		expect(patterns.filter((pattern) => !PAGE_PATTERNS.includes(pattern))).toEqual([]);
		expect(new Set(patterns).size).toBe(patterns.length);
	});

	it("declares the same audience the proxy enforces on the server for every page", () => {
		for (const rule of WEB_ROUTE_ACCESS) {
			const pathname = samplePathForPattern(rule.pattern, SAMPLE_PARAM);
			expect(rule.audience, `${rule.pattern} (${pathname})`).toBe(proxyAudience(pathname));
		}
	});

	it("only gates pages by capability inside the /rewardhub shell, where WebRouteAccessGuard is mounted", () => {
		const gatedOutsideShell = WEB_ROUTE_ACCESS.filter((rule) => rule.authorization !== undefined && !isPathWithin(rule.pattern, ROUTE_PREFIXES.rewardHub)).map(
			(rule) => rule.pattern,
		);

		expect(gatedOutsideShell).toEqual([]);
	});

	it("labels the dynamic signed-in pages for the breadcrumb", () => {
		expect(resolveWebTrailPage(rewardDetailPath("r"))).toEqual({ label: "Reward" });
		expect(resolveWebTrailPage(walletClaimPath("c"))).toEqual({ label: "Show at checkout" });
		expect(resolveWebTrailPage(ROUTES.rewardHub.wallet)).toEqual({ label: undefined });
		expect(resolveWebTrailPage(ROUTE_PREFIXES.rewardHubRewards)).toBeNull();
	});
});

describe("resolveWebRouteAccess", () => {
	it("matches pages exactly, including dynamic segments", () => {
		expect(resolveWebRouteAccess(walletClaimPath("claim-1"))?.audience).toBe("signed-in");
		expect(resolveWebRouteAccess(publicRewardDetailPath("reward-1"))?.audience).toBe("public");
		expect(resolveWebRouteAccess(ROUTES.auth.login)?.audience).toBe("guest");
	});

	it("returns null for URLs that are not pages", () => {
		expect(resolveWebRouteAccess(ROUTE_PREFIXES.rewardHubRewards)).toBeNull();
		expect(resolveWebRouteAccess(`${ROUTES.rewardHub.wallet}/claim-1/extra`)).toBeNull();
		expect(resolveWebRouteAccess("/rewardhubs")).toBeNull();
	});
});

describe("isWebRouteAllowed", () => {
	const gated: WebRouteAccessRule = { pattern: "/rewardhub/orders", audience: "signed-in", authorization: { permissions: [PERMISSION.ORDER.LIST] } };

	it("lets anyone open a public page", () => {
		const rule: WebRouteAccessRule = { pattern: ROUTES.home, audience: "public" };
		expect(isWebRouteAllowed(rule, GUEST)).toBe(true);
		expect(isWebRouteAllowed(rule, MEMBER)).toBe(true);
	});

	it("keeps guest-only pages away from signed-in sessions", () => {
		const rule: WebRouteAccessRule = { pattern: ROUTES.auth.login, audience: "guest" };
		expect(isWebRouteAllowed(rule, GUEST)).toBe(true);
		expect(isWebRouteAllowed(rule, MEMBER)).toBe(false);
	});

	it("requires a session for signed-in pages", () => {
		const rule: WebRouteAccessRule = { pattern: ROUTES.rewardHub.wallet, audience: "signed-in" };
		expect(isWebRouteAllowed(rule, MEMBER)).toBe(true);
		expect(isWebRouteAllowed(rule, GUEST)).toBe(false);
	});

	it("allows a capability-gated page only with the capability (MANAGE implies LIST)", () => {
		expect(isWebRouteAllowed(gated, session(true, [PERMISSION.ORDER.LIST]))).toBe(true);
		expect(isWebRouteAllowed(gated, session(true, [PERMISSION.ORDER.MANAGE]))).toBe(true);
		expect(isWebRouteAllowed(gated, session(true, [PERMISSION.PRODUCT.LIST]))).toBe(false);
		expect(isWebRouteAllowed(gated, MEMBER)).toBe(false);
	});

	it("denies a capability-gated page to a guest, even with the capability in hand", () => {
		expect(isWebRouteAllowed(gated, session(false, [PERMISSION.ORDER.LIST]))).toBe(false);
	});

	it("honours mode 'all'", () => {
		const both: WebRouteAccessRule = { ...gated, authorization: { permissions: [PERMISSION.ORDER.LIST, PERMISSION.PRODUCT.LIST], mode: "all" } };
		expect(isWebRouteAllowed(both, session(true, [PERMISSION.ORDER.LIST]))).toBe(false);
		expect(isWebRouteAllowed(both, session(true, [PERMISSION.ORDER.LIST, PERMISSION.PRODUCT.LIST]))).toBe(true);
	});
});

describe("canAccessWebPath", () => {
	it("evaluates the page's rule for the session", () => {
		expect(canAccessWebPath(ROUTES.rewardHub.wallet, MEMBER)).toBe(true);
		expect(canAccessWebPath(ROUTES.rewardHub.wallet, GUEST)).toBe(false);
		expect(canAccessWebPath(ROUTES.auth.login, MEMBER)).toBe(false);
	});

	it("denies URLs that are not pages (fail closed)", () => {
		expect(canAccessWebPath("/rewardhub/nearby", MEMBER)).toBe(false);
		expect(canAccessWebPath(ROUTE_PREFIXES.rewardHubRewards, MEMBER)).toBe(false);
	});
});

function flattenItems(items: readonly CompiledSidebarMenuItem[]): readonly CompiledSidebarMenuItem[] {
	return items.flatMap((item) => [item, ...flattenItems(item.children ?? [])]);
}

function menuItems(menu: CompiledSidebarMenuData): readonly CompiledSidebarMenuItem[] {
	return flattenItems([...menu.sections.flatMap((section) => section.items), ...menu.bottomItems]);
}

function visibleUrls(menu: CompiledSidebarMenuData, capabilities: readonly CapabilitySlug[]): ReadonlySet<string> {
	return new Set(menuItems(filterCompiledSidebarMenu(menu, capabilities)).map((item) => item.url));
}

const SAMPLE_CAPABILITY_SETS: readonly (readonly CapabilitySlug[])[] = [
	[],
	[PERMISSION.ORDER.LIST],
	[PERMISSION.ORDER.MANAGE],
	[PERMISSION.PRODUCT.LIST],
	[PERMISSION.ANALYTICS.READ],
];

describe("sidebar menu ⇔ route table (real consumer menu)", () => {
	const enabledItems = menuItems(USER_SIDEBAR_MENU).filter((item) => item.disabled !== true);

	it("links every enabled item to a page that has an access rule", () => {
		expect(enabledItems.filter((item) => resolveWebRouteAccess(item.url) === null).map((item) => item.url)).toEqual([]);
	});

	it("carries each page's capability requirement on its menu item", () => {
		for (const item of enabledItems) {
			expect(item.authorization, item.url).toEqual(resolveWebRouteAccess(item.url)?.authorization);
		}
	});

	it("shows an enabled item to a signed-in member exactly when its page is allowed", () => {
		for (const capabilities of SAMPLE_CAPABILITY_SETS) {
			const visible = visibleUrls(USER_SIDEBAR_MENU, capabilities);
			for (const item of enabledItems) {
				const rule = resolveWebRouteAccess(item.url);
				const allowed = rule !== null && isWebRouteAllowed(rule, session(true, capabilities));
				expect(visible.has(item.url), `${item.url} with [${capabilities.join(", ")}]`).toBe(allowed);
			}
		}
	});
});

describe("applyWebRouteAuthorization", () => {
	const ORDERS_PATTERN = "/rewardhub/orders";
	const RULES: readonly WebRouteAccessRule[] = [
		{ pattern: ROUTES.rewardHub.browse, audience: "signed-in" },
		{ pattern: ORDERS_PATTERN, audience: "signed-in", authorization: { permissions: [PERMISSION.ORDER.LIST] } },
	];
	const MENU: SidebarMenuData = {
		header: { title: "T", subtitle: "S" },
		sections: [
			{
				title: "Main",
				items: [
					{ title: "Browse", url: ROUTES.rewardHub.browse },
					{ title: "Orders", url: ORDERS_PATTERN },
					{ title: "Soon", url: "/rewardhub/soon", disabled: true },
				],
			},
		],
		bottomItems: [],
	};

	it("copies each page's requirement onto its menu item by URL", () => {
		const [browse, orders, soon] = applyWebRouteAuthorization(MENU, RULES).sections[LIST_SLOT_INDEX.first]?.items ?? [];

		expect(browse?.authorization).toBeUndefined();
		expect(orders?.authorization?.permissions).toEqual([PERMISSION.ORDER.LIST]);
		expect(soon?.authorization).toBeUndefined();
	});

	it("makes the capability filter hide a gated page's item without the capability and show it with it", () => {
		const compiled = compileMenu(applyWebRouteAuthorization(MENU, RULES));

		expect(visibleUrls(compiled, []).has(ORDERS_PATTERN)).toBe(false);
		expect(visibleUrls(compiled, [PERMISSION.ORDER.LIST]).has(ORDERS_PATTERN)).toBe(true);
		expect(visibleUrls(compiled, []).has(ROUTES.rewardHub.browse)).toBe(true);
	});
});

describe("command palette entries ⇔ route table", () => {
	it("points every palette entry at a page with an access rule", () => {
		expect(WEB_PALETTE_ITEMS.filter((item) => resolveWebRouteAccess(item.url) === null).map((item) => item.url)).toEqual([]);
	});

	it("offers signed-in members the app pages but not the sign-in page", () => {
		const urls = accessiblePaletteItems((href) => canAccessWebPath(href, MEMBER)).map((item) => item.url);

		expect(urls).toEqual(
			expect.arrayContaining([ROUTES.rewardHub.browse, ROUTES.rewardHub.wallet, ROUTES.rewardHub.activity, ROUTES.rewardHub.referrals, ROUTES.rewardHub.account]),
		);
		expect(urls).not.toContain(ROUTES.auth.login);
	});

	it("offers guests only the sign-in page", () => {
		const urls = accessiblePaletteItems((href) => canAccessWebPath(href, GUEST)).map((item) => item.url);

		expect(urls).toEqual([ROUTES.auth.login]);
	});
});
