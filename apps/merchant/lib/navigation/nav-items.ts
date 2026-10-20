import {
	BarChart3,
	CircleUser,
	KeyRound,
	LayoutDashboard,
	MapPin,
	MonitorSmartphone,
	Palette,
	ScanLine,
	Settings,
	ShieldCheck,
	Ticket,
	Users,
	type LucideIcon,
} from "lucide-react";

import type { CapabilitySlug } from "@workspace/shared";

import { canOpenOrgPath } from "@/lib/navigation/org-route-authorization";
import { TENANT_ROUTES, type AppPath } from "@/lib/routes";

/**
 * Command-palette / pinned entry. `url` is org-relative (`TENANT_ROUTES.*`),
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
		url: TENANT_ROUTES.dashboard,
		section: "Overview",
		description: "Store performance snapshot",
		icon: LayoutDashboard,
		keywords: ["dashboard", "home", "overview"],
	},
	{
		id: "analytics",
		title: "Analytics",
		url: TENANT_ROUTES.analytics,
		section: "Insights",
		description: "Performance and trends",
		icon: BarChart3,
		keywords: ["analytics", "stats", "charts", "metrics"],
	},
	{
		id: "rewards",
		title: "Rewards",
		url: TENANT_ROUTES.rewards.list,
		section: "Rewards",
		description: "Offers and inventory",
		icon: Ticket,
		keywords: ["rewards", "offers", "drafts"],
	},
	{
		id: "rewards-new",
		title: "Create reward",
		url: TENANT_ROUTES.rewards.new,
		section: "Rewards",
		description: "Launch a new campaign",
		icon: Ticket,
		keywords: ["create", "new", "reward", "draft"],
	},
	{
		id: "redemptions",
		title: "Redemptions",
		url: TENANT_ROUTES.redemptions,
		section: "Operations",
		description: "POS activity",
		icon: ScanLine,
		keywords: ["redemptions", "pos", "activity"],
	},
	{
		id: "terminals",
		title: "POS terminals",
		url: TENANT_ROUTES.terminals,
		section: "Operations",
		description: "Pair and manage tills",
		icon: MonitorSmartphone,
		keywords: ["terminals", "pos", "till", "pairing", "register", "device"],
	},
	{
		id: "api-keys",
		title: "API keys",
		url: TENANT_ROUTES.apiKeys,
		section: "Operations",
		description: "Terminal access",
		icon: KeyRound,
		keywords: ["api", "keys", "terminal"],
	},
	{
		id: "settings",
		title: "Tenant settings",
		url: TENANT_ROUTES.settings.index,
		section: "Settings",
		description: "Team, locations, branding, and verification",
		icon: Settings,
		keywords: ["settings", "tenant", "team", "locations", "branding", "logo", "verification", "kyb"],
	},
	{
		id: "settings-team",
		title: "Team & access",
		url: TENANT_ROUTES.settings.team,
		section: "Settings",
		description: "Members, invitations, and roles",
		icon: Users,
		keywords: ["team", "members", "invite", "roles", "staff"],
	},
	{
		id: "settings-locations",
		title: "Store locations",
		url: TENANT_ROUTES.settings.locations,
		section: "Settings",
		description: "Stores under this tenant",
		icon: MapPin,
		keywords: ["locations", "stores", "branches", "address"],
	},
	{
		id: "settings-branding",
		title: "Store branding",
		url: TENANT_ROUTES.settings.branding,
		section: "Settings",
		description: "Your store's logo",
		icon: Palette,
		keywords: ["branding", "logo", "brand", "image", "store"],
	},
	{
		id: "settings-verification",
		title: "Business verification",
		url: TENANT_ROUTES.settings.verification,
		section: "Settings",
		description: "KYB details and documents",
		icon: ShieldCheck,
		keywords: ["verification", "kyb", "business", "documents"],
	},
	{
		id: "account",
		title: "Account",
		url: TENANT_ROUTES.account,
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
