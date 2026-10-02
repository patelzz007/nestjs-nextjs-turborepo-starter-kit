import { BarChart3, Gift, LogIn, Ticket, UserCog, type LucideIcon } from "lucide-react";

import { ROUTES } from "@/lib/routes";

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
		url: ROUTES.rewardHub.browse,
		section: "Rewards",
		description: "Discover local offers",
		icon: Gift,
		keywords: ["discover", "marketplace", "deals", "browse"],
	},
	{
		id: "activity",
		title: "My activity",
		url: ROUTES.rewardHub.activity,
		section: "Rewards",
		description: "Claims and referral stats",
		icon: BarChart3,
		keywords: ["analytics", "stats", "activity", "trends"],
	},
	{
		id: "wallet",
		title: "My wallet",
		url: ROUTES.rewardHub.wallet,
		section: "Rewards",
		description: "Your claimed offers",
		icon: Ticket,
		keywords: ["claims", "wallet", "qr", "redeem", "my rewards"],
	},
	{
		id: "account",
		title: "Account",
		url: ROUTES.rewardHub.account,
		section: "Account",
		description: "Email, password and two-factor authentication",
		icon: UserCog,
		keywords: ["account", "settings", "profile", "password", "security", "2fa", "mfa", "verify email"],
	},
];

export const WEB_AUTH_NAV_ITEM: WebNavItem = {
	id: "login",
	title: "Sign in",
	url: ROUTES.auth.login,
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
