import { BarChart3, CircleUser, KeyRound, LayoutDashboard, MapPin, MonitorSmartphone, ScanLine, Settings, ShieldCheck, Ticket, Users, type LucideIcon } from "lucide-react";

import type { CapabilitySlug } from "@workspace/shared";

import { canOpenOrgPath } from "@/lib/navigation/org-route-authorization";
import { ORG_ROUTES, type AppPath } from "@/lib/routes";

/**
 * Command-palette / pinned entry. `url` is org-relative (`ORG_ROUTES.*`),
 * resolved like sidebar URLs. Visibility comes from the page's rule in
 * `ORG_PAGE_RULES` — an entry is listed exactly when its page would render.
 */
export interface MerchantNavItem {
	readonly id: string;
	readonly title: string;
	readonly url: AppPath;
	readonly section: string;
	readonly description: string;
	readonly icon: LucideIcon;
	readonly keywords: readonly string[];
}

export const MERCHANT_NAV_ITEMS: readonly MerchantNavItem[] = [
	{
		id: "dashboard",
		title: "Dashboard",
		url: ORG_ROUTES.dashboard,
		section: "Overview",
		description: "Store performance snapshot",
		icon: LayoutDashboard,
		keywords: ["dashboard", "home", "overview"],
	},
	{
		id: "analytics",
		title: "Analytics",
		url: ORG_ROUTES.analytics,
		section: "Insights",
		description: "Performance and trends",
		icon: BarChart3,
		keywords: ["analytics", "stats", "charts", "metrics"],
	},
	{
		id: "rewards",
		title: "Rewards",
		url: ORG_ROUTES.rewards.list,
		section: "Rewards",
		description: "Offers and inventory",
		icon: Ticket,
		keywords: ["rewards", "offers", "drafts"],
	},
	{
		id: "rewards-new",
		title: "Create reward",
		url: ORG_ROUTES.rewards.new,
		section: "Rewards",
		description: "Launch a new campaign",
		icon: Ticket,
		keywords: ["create", "new", "reward", "draft"],
	},
	{
		id: "redemptions",
		title: "Redemptions",
		url: ORG_ROUTES.redemptions,
		section: "Operations",
		description: "POS activity",
		icon: ScanLine,
		keywords: ["redemptions", "pos", "activity"],
	},
	{
		id: "terminals",
		title: "POS terminals",
		url: ORG_ROUTES.terminals,
		section: "Operations",
		description: "Pair and manage tills",
		icon: MonitorSmartphone,
		keywords: ["terminals", "pos", "till", "pairing", "register", "device"],
	},
	{
		id: "api-keys",
		title: "API keys",
		url: ORG_ROUTES.apiKeys,
		section: "Operations",
		description: "Terminal access",
		icon: KeyRound,
		keywords: ["api", "keys", "terminal"],
	},
	{
		id: "settings",
		title: "Organization settings",
		url: ORG_ROUTES.settings.index,
		section: "Settings",
		description: "Team, locations, and verification",
		icon: Settings,
		keywords: ["settings", "organization", "team", "locations", "verification", "kyb"],
	},
	{
		id: "settings-team",
		title: "Team & access",
		url: ORG_ROUTES.settings.team,
		section: "Settings",
		description: "Members, invitations, and roles",
		icon: Users,
		keywords: ["team", "members", "invite", "roles", "staff"],
	},
	{
		id: "settings-locations",
		title: "Store locations",
		url: ORG_ROUTES.settings.locations,
		section: "Settings",
		description: "Stores under this organization",
		icon: MapPin,
		keywords: ["locations", "stores", "branches", "address"],
	},
	{
		id: "settings-verification",
		title: "Business verification",
		url: ORG_ROUTES.settings.verification,
		section: "Settings",
		description: "KYB details and documents",
		icon: ShieldCheck,
		keywords: ["verification", "kyb", "business", "documents"],
	},
	{
		id: "account",
		title: "Account",
		url: ORG_ROUTES.account,
		section: "Settings",
		description: "Profile, password, and two-factor authentication",
		icon: CircleUser,
		keywords: ["account", "profile", "password", "security", "2fa", "mfa", "email"],
	},
];

/** Capability predicate — pass `useAuthorization().can` so nav uses the shared checker. */
export type MerchantCapabilityPredicate = (permission: CapabilitySlug) => boolean;

export function filterMerchantNavItems(items: readonly MerchantNavItem[], can: MerchantCapabilityPredicate): readonly MerchantNavItem[] {
	return items.filter((item) => canOpenOrgPath(item.url, can));
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
