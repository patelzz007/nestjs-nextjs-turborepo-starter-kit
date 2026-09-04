import { BarChart3, KeyRound, LayoutDashboard, ScanLine, Ticket, type LucideIcon } from "lucide-react";

import type { MerchantCapability } from "@workspace/shared";
import { merchantHasCapability } from "@workspace/shared";

export interface MerchantNavItem {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly section: string;
	readonly description: string;
	readonly icon: LucideIcon;
	readonly keywords: readonly string[];
	readonly requiredCapability?: MerchantCapability;
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
		requiredCapability: "merchant:view_dashboard",
	},
	{
		id: "analytics",
		title: "Analytics",
		url: "/analytics",
		section: "Insights",
		description: "Performance and trends",
		icon: BarChart3,
		keywords: ["analytics", "stats", "charts", "metrics"],
		requiredCapability: "merchant:view_analytics",
	},
	{
		id: "rewards",
		title: "Rewards",
		url: "/rewards",
		section: "Rewards",
		description: "Offers and inventory",
		icon: Ticket,
		keywords: ["rewards", "offers", "drafts"],
		requiredCapability: "merchant:view_rewards",
	},
	{
		id: "rewards-new",
		title: "Create reward",
		url: "/rewards/new",
		section: "Rewards",
		description: "Launch a new campaign",
		icon: Ticket,
		keywords: ["create", "new", "reward", "draft"],
		requiredCapability: "merchant:manage_rewards",
	},
	{
		id: "redemptions",
		title: "Redemptions",
		url: "/redemptions",
		section: "Operations",
		description: "POS activity",
		icon: ScanLine,
		keywords: ["redemptions", "pos", "activity"],
		requiredCapability: "merchant:view_redemptions",
	},
	{
		id: "api-keys",
		title: "API keys",
		url: "/api-keys",
		section: "Operations",
		description: "Terminal access",
		icon: KeyRound,
		keywords: ["api", "keys", "terminal"],
		requiredCapability: "merchant:manage_api_keys",
	},
];

export function filterMerchantNavItems(items: readonly MerchantNavItem[], capabilities: readonly MerchantCapability[]): readonly MerchantNavItem[] {
	return items.filter((item) => item.requiredCapability === undefined || merchantHasCapability(capabilities, item.requiredCapability));
}

export function resolvePinnedMerchantNavItems(pinnedUrls: readonly string[], capabilities: readonly MerchantCapability[]): readonly MerchantNavItem[] {
	return pinnedUrls
		.map((url) => filterMerchantNavItems(MERCHANT_NAV_ITEMS, capabilities).find((item) => item.url === url))
		.filter((item): item is MerchantNavItem => item !== undefined);
}

export function matchesMerchantNavQuery(item: MerchantNavItem, query: string): boolean {
	const normalized = query.trim().toLowerCase();
	if (normalized.length === 0) {
		return true;
	}
	const haystack = [item.title, item.description, item.section, ...item.keywords].join(" ").toLowerCase();
	return haystack.includes(normalized);
}
