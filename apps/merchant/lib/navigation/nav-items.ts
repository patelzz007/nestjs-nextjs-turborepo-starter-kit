import { BarChart3, KeyRound, LayoutDashboard, ScanLine, Ticket, type LucideIcon } from "lucide-react";

import { MERCHANT_CAPABILITY, type CapabilitySlug } from "@workspace/shared";

export interface MerchantNavItem {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly section: string;
	readonly description: string;
	readonly icon: LucideIcon;
	readonly keywords: readonly string[];
	readonly requiredCapability?: CapabilitySlug;
}

export const MERCHANT_NAV_ITEMS: readonly MerchantNavItem[] = [
	{
		id: "dashboard",
		title: "Dashboard",
		url: "/",
		section: "Overview",
		description: "Store performance snapshot",
		icon: LayoutDashboard,
		keywords: ["dashboard", "home", "overview"],
		requiredCapability: MERCHANT_CAPABILITY.viewDashboard,
	},
	{
		id: "analytics",
		title: "Analytics",
		url: "/analytics",
		section: "Insights",
		description: "Performance and trends",
		icon: BarChart3,
		keywords: ["analytics", "stats", "charts", "metrics"],
		requiredCapability: MERCHANT_CAPABILITY.viewAnalytics,
	},
	{
		id: "rewards",
		title: "Rewards",
		url: "/rewards",
		section: "Rewards",
		description: "Offers and inventory",
		icon: Ticket,
		keywords: ["rewards", "offers", "drafts"],
		requiredCapability: MERCHANT_CAPABILITY.viewRewards,
	},
	{
		id: "rewards-new",
		title: "Create reward",
		url: "/rewards/new",
		section: "Rewards",
		description: "Launch a new campaign",
		icon: Ticket,
		keywords: ["create", "new", "reward", "draft"],
		requiredCapability: MERCHANT_CAPABILITY.manageRewards,
	},
	{
		id: "redemptions",
		title: "Redemptions",
		url: "/redemptions",
		section: "Operations",
		description: "POS activity",
		icon: ScanLine,
		keywords: ["redemptions", "pos", "activity"],
		requiredCapability: MERCHANT_CAPABILITY.viewRedemptions,
	},
	{
		id: "api-keys",
		title: "API keys",
		url: "/api-keys",
		section: "Operations",
		description: "Terminal access",
		icon: KeyRound,
		keywords: ["api", "keys", "terminal"],
		requiredCapability: MERCHANT_CAPABILITY.manageApiKeys,
	},
];

/** Capability predicate — pass `useAuthorization().can` so nav uses the shared checker. */
export type MerchantCapabilityPredicate = (permission: CapabilitySlug) => boolean;

export function filterMerchantNavItems(items: readonly MerchantNavItem[], can: MerchantCapabilityPredicate): readonly MerchantNavItem[] {
	return items.filter((item) => item.requiredCapability === undefined || can(item.requiredCapability));
}

export function resolvePinnedMerchantNavItems(pinnedUrls: readonly string[], can: MerchantCapabilityPredicate): readonly MerchantNavItem[] {
	const allowedItems = filterMerchantNavItems(MERCHANT_NAV_ITEMS, can);
	return pinnedUrls.map((url) => allowedItems.find((item) => item.url === url)).filter((item): item is MerchantNavItem => item !== undefined);
}

export function matchesMerchantNavQuery(item: MerchantNavItem, query: string): boolean {
	const normalized = query.trim().toLowerCase();
	if (normalized.length === 0) {
		return true;
	}
	const haystack = [item.title, item.description, item.section, ...item.keywords].join(" ").toLowerCase();
	return haystack.includes(normalized);
}
