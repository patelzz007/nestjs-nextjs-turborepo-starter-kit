import { FileText, Home, type LucideIcon } from "lucide-react";
import { describe, expect, it } from "vitest";

import type { BreadcrumbItem } from "@workspace/ui/components/navigation/breadcrumb-context";

import {
	resolveSidebarMenuTrail,
	withTrailTailLabel,
	type ResolveSidebarMenuTrailConfig,
	type SidebarMenuTrailData,
	type SidebarTrailPage,
} from "./resolve-sidebar-menu-trail";

function resolveIcon(): LucideIcon {
	return FileText;
}

/** Every page sits under one base segment, like the consumer web app (`/hub`). */
const SINGLE_BASE_MENU: SidebarMenuTrailData = {
	sections: [
		{
			title: "Rewards",
			items: [
				{ title: "Browse", url: "/hub" },
				{ title: "Nearby", url: "/hub/nearby" },
			],
		},
		{
			title: "Wallet",
			items: [
				{ title: "My Wallet", url: "/hub/wallet" },
				{ title: "Expired", url: "/hub/wallet/expired" },
			],
		},
		{
			title: "Earn",
			items: [
				{ title: "Referrals", url: "/hub/referrals", children: [{ title: "Invite", url: "/hub/referrals/invite" }] },
				{ title: "Points", url: "/hub/points", children: [{ title: "Balance", url: "/hub/points/balance" }] },
			],
		},
	],
	bottomItems: [{ title: "Account", url: "/hub/account" }],
};

/** Pages of the single-base app that have no menu entry. */
const PAGES: ReadonlyMap<string, SidebarTrailPage> = new Map<string, SidebarTrailPage>([
	["/hub/offers/42", { label: "Offer" }],
	["/hub/wallet/claim-1", { label: "Redemption code" }],
	["/hub/wallet/claim-1/receipt", {}],
	["/hub/docs/guides", {}],
	["/hub/docs/guides/setup", {}],
]);

function resolvePage(pathname: string): SidebarTrailPage | null {
	return PAGES.get(pathname) ?? null;
}

type TrailOptions = Partial<Pick<ResolveSidebarMenuTrailConfig, "includeSectionContext" | "resolvePage" | "menu">>;

function trailOf(pathname: string, options: TrailOptions = {}): readonly { readonly label: string; readonly href: string | undefined }[] {
	const trail: readonly BreadcrumbItem[] = resolveSidebarMenuTrail({
		menu: options.menu ?? SINGLE_BASE_MENU,
		pathname,
		resolveIcon,
		rootCurrentLabel: "Home",
		rootIcon: Home,
		unknownFallbackLabel: "Home",
		...(options.includeSectionContext !== undefined ? { includeSectionContext: options.includeSectionContext } : {}),
		...(options.resolvePage !== undefined ? { resolvePage: options.resolvePage } : {}),
	});
	return trail.map((crumb) => ({ label: crumb.label, href: crumb.href }));
}

const WEB_OPTIONS: TrailOptions = { includeSectionContext: false, resolvePage };

describe("resolveSidebarMenuTrail — section context (default on)", () => {
	it("prepends the section title for an item of a multi-item section", () => {
		expect(trailOf("/hub/wallet")).toEqual([
			{ label: "Wallet", href: undefined },
			{ label: "My Wallet", href: "/hub/wallet" },
		]);
	});

	it("starts at the item itself when section context is turned off", () => {
		expect(trailOf("/hub/wallet", { includeSectionContext: false })).toEqual([{ label: "My Wallet", href: undefined }]);
		expect(trailOf("/hub", { includeSectionContext: false })).toEqual([{ label: "Browse", href: undefined }]);
	});

	it("omits the section crumb for nested items too when turned off", () => {
		expect(trailOf("/hub/referrals/invite", { includeSectionContext: false })).toEqual([
			{ label: "Referrals", href: "/hub/referrals" },
			{ label: "Invite", href: undefined },
		]);
		expect(trailOf("/hub/referrals/invite")).toEqual([
			{ label: "Earn", href: undefined },
			{ label: "Referrals", href: "/hub/referrals" },
			{ label: "Invite", href: undefined },
		]);
	});
});

describe("resolveSidebarMenuTrail — segment-root matching", () => {
	it("does not let an unrelated parent capture a page that has a real menu ancestor", () => {
		// `/hub/referrals` shares the `hub` segment with every page; it must not
		// swallow the bottom-item page or a page below another menu item.
		expect(trailOf("/hub/account", WEB_OPTIONS)).toEqual([{ label: "Account", href: undefined }]);
		expect(trailOf("/hub/wallet/claim-1", WEB_OPTIONS)).toEqual([
			{ label: "My Wallet", href: "/hub/wallet" },
			{ label: "Redemption code", href: undefined },
		]);
	});

	it("still falls back to a parent sharing the first segment when no menu URL is an ancestor", () => {
		const menu: SidebarMenuTrailData = {
			sections: [{ title: "Main", items: [{ title: "Reports", url: "/reports/overview", children: [{ title: "Sales", url: "/reports/overview/sales" }] }] }],
			bottomItems: [],
		};
		expect(trailOf("/reports/archive", { menu })).toEqual([
			{ label: "Reports", href: "/reports/overview" },
			{ label: "Archive", href: undefined },
		]);
	});
});

describe("resolveSidebarMenuTrail — page-aware segments (resolvePage)", () => {
	it("drops an intermediate segment that is not a page and labels the page", () => {
		expect(trailOf("/hub/offers/42", WEB_OPTIONS)).toEqual([
			{ label: "Browse", href: "/hub" },
			{ label: "Offer", href: undefined },
		]);
	});

	it("links an intermediate segment that is a page", () => {
		expect(trailOf("/hub/wallet/claim-1/receipt", WEB_OPTIONS)).toEqual([
			{ label: "My Wallet", href: "/hub/wallet" },
			{ label: "Redemption code", href: "/hub/wallet/claim-1" },
			{ label: "Receipt", href: undefined },
		]);
	});

	it("humanizes the current segment when the page has no label", () => {
		expect(trailOf("/hub/docs/guides/setup", WEB_OPTIONS)).toEqual([
			{ label: "Browse", href: "/hub" },
			{ label: "Guides", href: "/hub/docs/guides" },
			{ label: "Setup", href: undefined },
		]);
	});

	it("keeps the current segment even when it is not a known page", () => {
		expect(trailOf("/hub/unknown/thing", WEB_OPTIONS)).toEqual([
			{ label: "Browse", href: "/hub" },
			{ label: "Thing", href: undefined },
		]);
	});

	it("keeps the legacy behaviour without a page resolver: every segment, unlinked", () => {
		// Section context applies to every anchored trail, a top-level leaf anchor included.
		expect(trailOf("/hub/offers/42")).toEqual([
			{ label: "Rewards", href: undefined },
			{ label: "Browse", href: "/hub" },
			{ label: "Offers", href: undefined },
			{ label: "42", href: undefined },
		]);
	});
});

/** A branch whose children are leaves with their own detail pages, like admin Platform → Catalog → Products. */
const NESTED_LEAF_MENU: SidebarMenuTrailData = {
	sections: [
		{
			title: "Platform",
			items: [
				{
					title: "Catalog",
					url: "/catalog",
					children: [
						{ title: "Products", url: "/catalog/products" },
						{ title: "Categories", url: "/catalog/categories" },
					],
				},
				{ title: "Settings", url: "/settings", children: [{ title: "Billing", url: "/settings/billing" }] },
			],
		},
	],
	bottomItems: [{ title: "Account", url: "/account" }],
};

describe("resolveSidebarMenuTrail — leaf ancestors", () => {
	it("anchors a detail page on a nested LEAF entry instead of skipping it", () => {
		expect(trailOf("/catalog/products/42", { menu: NESTED_LEAF_MENU })).toEqual([
			{ label: "Platform", href: undefined },
			{ label: "Catalog", href: "/catalog" },
			{ label: "Products", href: "/catalog/products" },
			{ label: "42", href: undefined },
		]);
		expect(trailOf("/catalog/products/42/edit", { menu: NESTED_LEAF_MENU })).toEqual([
			{ label: "Platform", href: undefined },
			{ label: "Catalog", href: "/catalog" },
			{ label: "Products", href: "/catalog/products" },
			{ label: "42", href: undefined },
			{ label: "Edit", href: undefined },
		]);
	});

	it("anchors on a top-level leaf (bottom item) and labels the segments below it", () => {
		expect(trailOf("/account/security", { menu: NESTED_LEAF_MENU })).toEqual([
			{ label: "Account", href: "/account" },
			{ label: "Security", href: undefined },
		]);
	});

	it("picks the deepest match across the whole menu", () => {
		const menu: SidebarMenuTrailData = {
			sections: [
				{ title: "Main", items: [{ title: "Area", url: "/a", children: [{ title: "Deep", url: "/a/b/c" }] }] },
				{ title: "Main", items: [{ title: "Shallow", url: "/a/b" }] },
			],
			bottomItems: [],
		};
		expect(trailOf("/a/b/c/d", { menu })).toEqual([
			{ label: "Area", href: "/a" },
			{ label: "Deep", href: "/a/b/c" },
			{ label: "D", href: undefined },
		]);
	});
});

describe("resolveSidebarMenuTrail — fallbacks", () => {
	it("names the root and links unknown top-level pages back to it", () => {
		expect(trailOf("/")).toEqual([{ label: "Home", href: undefined }]);
		expect(trailOf("/elsewhere")).toEqual([{ label: "Home", href: "/" }]);
	});

	it("gives every crumb an icon", () => {
		for (const pathname of ["/hub", "/hub/offers/42", "/hub/wallet/claim-1/receipt", "/hub/account", "/elsewhere"]) {
			const trail = resolveSidebarMenuTrail({
				menu: SINGLE_BASE_MENU,
				pathname,
				resolveIcon,
				rootCurrentLabel: "Home",
				rootIcon: Home,
				unknownFallbackLabel: "Home",
				resolvePage,
			});
			for (const crumb of trail) {
				expect(crumb.icon, `${pathname} → ${crumb.label}`).toBeDefined();
			}
		}
	});
});

describe("withTrailTailLabel", () => {
	it("renames only the final crumb and keeps its icon", () => {
		const trail = withTrailTailLabel(
			[
				{ label: "Browse", href: "/hub", icon: Home },
				{ label: "Offer", icon: FileText },
			],
			"Free coffee",
		);
		expect(trail.map((crumb) => crumb.label)).toEqual(["Browse", "Free coffee"]);
		expect(trail[1]?.icon).toBe(FileText);
		expect(trail[1]?.href).toBeUndefined();
	});

	it("creates a single crumb for an empty trail", () => {
		expect(withTrailTailLabel([], "Free coffee").map((crumb) => crumb.label)).toEqual(["Free coffee"]);
	});
});
