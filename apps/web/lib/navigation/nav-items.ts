import { BarChart3, Gift, LogIn, Ticket, type LucideIcon } from "lucide-react";

export interface WebNavItem {
	readonly id: string;
	readonly title: string;
	readonly url: string;
	readonly section: string;
	readonly description: string;
	readonly icon: LucideIcon;
	readonly keywords: readonly string[];
}

export const WEB_NAV_ITEMS: readonly WebNavItem[] = [
	{
		id: "browse",
		title: "Browse rewards",
		url: "/",
		section: "Rewards",
		description: "Discover local offers",
		icon: Gift,
		keywords: ["discover", "marketplace", "deals", "browse"],
	},
	{
		id: "analytics",
		title: "My activity",
		url: "/rewardhub/analytics",
		section: "Rewards",
		description: "Claims and referral stats",
		icon: BarChart3,
		keywords: ["analytics", "stats", "activity", "trends"],
	},
	{
		id: "claims",
		title: "My rewards",
		url: "/rewardhub/claims",
		section: "Rewards",
		description: "Your claimed offers",
		icon: Ticket,
		keywords: ["claims", "wallet", "qr", "redeem"],
	},
];

export const WEB_AUTH_NAV_ITEM: WebNavItem = {
	id: "login",
	title: "Sign in",
	url: "/auth/login",
	section: "Account",
	description: "Access your rewards",
	icon: LogIn,
	keywords: ["login", "account", "auth"],
};

export function resolvePinnedNavItems(pinnedUrls: readonly string[]): readonly WebNavItem[] {
	const allItems: readonly WebNavItem[] = [...WEB_NAV_ITEMS, WEB_AUTH_NAV_ITEM];
	return pinnedUrls.map((url) => allItems.find((item) => item.url === url)).filter((item): item is WebNavItem => item !== undefined);
}

export function matchesNavQuery(item: WebNavItem, query: string): boolean {
	const normalized = query.trim().toLowerCase();
	if (normalized.length === 0) {
		return true;
	}
	const haystack = [item.title, item.description, item.section, ...item.keywords].join(" ").toLowerCase();
	return haystack.includes(normalized);
}
