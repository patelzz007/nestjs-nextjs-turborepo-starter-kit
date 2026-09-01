import { BarChart3, KeyRound, LayoutDashboard, ScanLine, Ticket, type LucideIcon } from "lucide-react";

export interface MerchantNavItem {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly section: string;
	readonly description: string;
	readonly icon: LucideIcon;
	readonly keywords: readonly string[];
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
	},
	{
		id: "analytics",
		title: "Analytics",
		url: "/analytics",
		section: "Insights",
		description: "Performance and trends",
		icon: BarChart3,
		keywords: ["analytics", "stats", "charts", "metrics"],
	},
	{
		id: "rewards",
		title: "Rewards",
		url: "/rewards",
		section: "Operations",
		description: "Offers and inventory",
		icon: Ticket,
		keywords: ["rewards", "offers", "drafts"],
	},
	{
		id: "redemptions",
		title: "Redemptions",
		url: "/redemptions",
		section: "Operations",
		description: "POS activity",
		icon: ScanLine,
		keywords: ["redemptions", "pos", "activity"],
	},
	{
		id: "api-keys",
		title: "API keys",
		url: "/api-keys",
		section: "Operations",
		description: "Terminal access",
		icon: KeyRound,
		keywords: ["api", "keys", "terminal"],
	},
];

export function resolvePinnedMerchantNavItems(pinnedUrls: readonly string[]): readonly MerchantNavItem[] {
	return pinnedUrls.map((url) => MERCHANT_NAV_ITEMS.find((item) => item.url === url)).filter((item): item is MerchantNavItem => item !== undefined);
}

export function matchesMerchantNavQuery(item: MerchantNavItem, query: string): boolean {
	const normalized = query.trim().toLowerCase();
	if (normalized.length === 0) {
		return true;
	}
	const haystack = [item.title, item.description, item.section, ...item.keywords].join(" ").toLowerCase();
	return haystack.includes(normalized);
}
