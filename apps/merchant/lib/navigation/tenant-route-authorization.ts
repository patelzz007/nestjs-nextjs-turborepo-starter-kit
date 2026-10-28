import { evaluateSidebarAuthorization } from "@workspace/client/lib/navigation/filter-sidebar-menu-by-capabilities";
import { MERCHANT_CAPABILITY, type CapabilitySlug, type MerchantCapability } from "@workspace/shared";
import { z } from "zod";

import { stripQueryAndHash } from "@/lib/routes";

/**
 * Every page under `app/t/[tenantSlug]/`, as its tenant-relative route pattern
 * (dynamic segments keep their `[param]` folder name). A test fails when a
 * page exists without an entry here, when an entry has no page, or when a
 * page does not call `guardTenantPage` with its own pattern — so no tenant route
 * is ever silently unguarded.
 */
export const TenantPageRouteSchema = z.enum([
	"/",
	"/dashboard",
	"/rewards",
	"/rewards/new",
	"/rewards/[rewardId]",
	"/rewards/[rewardId]/edit",
	"/redemptions",
	"/analytics",
	"/terminals",
	"/api-keys",
	"/settings",
	"/settings/team",
	"/settings/team/roles",
	"/settings/team/roles/new",
	"/settings/team/roles/[roleId]",
	"/settings/team/roles/[roleId]/edit",
	"/settings/team/members/[membershipId]",
	"/settings/integrations",
	"/settings/locations",
	"/settings/branding",
	"/settings/verification",
	"/settings/banned-customers",
	"/account",
	"/stores",
]);

export type TenantPageRoute = z.output<typeof TenantPageRouteSchema>;

/** Copy for the access-denied state of one page (defaults to the generic `MerchantAccessDenied` text). */
export interface TenantPageDenialCopy {
	readonly title: string;
	readonly description: string;
}

/** `merchant:*` capabilities a page needs — `any` (default) or `all` of them. */
export interface TenantPageRequirement {
	readonly permissions: readonly MerchantCapability[];
	readonly mode?: "any" | "all";
}

/** A page every member of the tenant may open; `reason` documents why it carries no capability. */
export interface OpenTenantPageRule {
	readonly kind: "open";
	readonly reason: string;
}

/** A page gated by merchant capabilities — the same ones the API endpoints behind it enforce. */
export interface CapabilityTenantPageRule {
	readonly kind: "capability";
	readonly requirement: TenantPageRequirement;
	readonly denial?: TenantPageDenialCopy;
}

export type TenantPageRule = OpenTenantPageRule | CapabilityTenantPageRule;

const OWNER_ONLY_VERIFICATION_DENIAL: TenantPageDenialCopy = {
	title: "Owner access required",
	description: "Business verification is submitted and updated by the tenant owner. Contact your store owner if details need to change.",
};

const BANNED_CUSTOMERS_DENIAL: TenantPageDenialCopy = {
	title: "Reward management access required",
	description: "Only members who manage rewards can see and lift customer bans. Contact your store owner if you need access.",
};

const TEAM_DENIAL: TenantPageDenialCopy = {
	title: "Team access required",
	description: "Your role can't view or manage team members. Contact your store owner if you need access.",
};

/**
 * Tenant route → capability map: the single authorization source for tenant pages,
 * the command palette and pinned items (the sidebar JSON carries the same
 * requirements, enforced by a test). UX only — the API stays authoritative.
 * Each rule names the API rule it mirrors.
 */
export const ORG_PAGE_RULES: Readonly<Record<TenantPageRoute, TenantPageRule>> = {
	"/": { kind: "open", reason: "Redirects to the dashboard, which is guarded itself." },
	// Tenant summary from the member-wide GET /t/:tenantSlug/context.
	"/dashboard": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewDashboard] } },
	// GET /t/:tenantSlug/rewards (merchant:view_rewards).
	"/rewards": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewRewards] } },
	// POST /t/:tenantSlug/rewards (merchant:manage_rewards).
	"/rewards/new": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageRewards] } },
	// GET /t/:tenantSlug/rewards (merchant:view_rewards) — the read-only reward page; its edit and submit actions need merchant:manage_rewards in-page.
	"/rewards/[rewardId]": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewRewards] } },
	// PATCH /t/:tenantSlug/rewards/:rewardId (merchant:manage_rewards).
	"/rewards/[rewardId]/edit": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageRewards] } },
	// GET /t/:tenantSlug/redemptions (merchant:view_redemptions).
	"/redemptions": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewRedemptions] } },
	// GET /t/:tenantSlug/analytics (merchant:view_analytics).
	"/analytics": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewAnalytics] } },
	// /t/:tenantSlug/terminals[/settings] (merchant:manage_api_keys — a paired till receives an API key).
	"/terminals": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageApiKeys] } },
	// /t/:tenantSlug/api-keys (merchant:manage_api_keys).
	"/api-keys": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageApiKeys] } },
	// Settings index: reachable when at least one settings page is.
	"/settings": {
		kind: "capability",
		requirement: {
			permissions: [MERCHANT_CAPABILITY.manageTeam, MERCHANT_CAPABILITY.viewLocations, MERCHANT_CAPABILITY.manageVerification, MERCHANT_CAPABILITY.manageRewards],
			mode: "any",
		},
	},
	// GET /t/:tenantSlug/members[/invites], POST …/members/invite (merchant:manage_team).
	"/settings/team": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageTeam] }, denial: TEAM_DENIAL },
	// /t/:tenantSlug/access/roles… (role.read / role.create / role.update — the API decides each).
	"/settings/team/roles": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageTeam] }, denial: TEAM_DENIAL },
	"/settings/team/roles/new": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageTeam] }, denial: TEAM_DENIAL },
	"/settings/team/roles/[roleId]": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageTeam] }, denial: TEAM_DENIAL },
	"/settings/team/roles/[roleId]/edit": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageTeam] }, denial: TEAM_DENIAL },
	// Counts of GET /t/:tenantSlug/terminals and …/api-keys (merchant:manage_api_keys), with links to manage them.
	"/settings/integrations": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageApiKeys] } },
	// /t/:tenantSlug/access/members/:membershipId… (member.read / member.update).
	"/settings/team/members/[membershipId]": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageTeam] }, denial: TEAM_DENIAL },
	// Reads the member-wide tenant context; requesting stores needs merchant:manage_locations in-page.
	"/settings/locations": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewLocations] } },
	// Reads the logo from the member-wide tenant context; uploading or removing it (POST /files, DELETE /files/:id) needs merchant:manage_locations in-page.
	"/settings/branding": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewLocations] } },
	// GET/PATCH /t/:tenantSlug/kyb (merchant:manage_verification, owner-only).
	"/settings/verification": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageVerification] }, denial: OWNER_ONLY_VERIFICATION_DENIAL },
	// GET /t/:tenantSlug/customer-bans, POST …/customer-bans/:banId/lift (merchant:manage_rewards).
	"/settings/banned-customers": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageRewards] }, denial: BANNED_CUSTOMERS_DENIAL },
	"/account": { kind: "open", reason: "Personal account (password, 2FA, email) — restricted enrollment sessions must always reach it." },
	"/stores": { kind: "open", reason: "The member's own stores (GET /t/memberships lists only the caller's memberships) — the way to switch to any of them." },
};

function isDynamicSegment(segment: string): boolean {
	return segment.startsWith("[") && segment.endsWith("]");
}

function routeSegments(path: string): readonly string[] {
	return stripQueryAndHash(path)
		.split("/")
		.filter((segment) => segment.length > 0);
}

function matchesRoutePattern(route: TenantPageRoute, segments: readonly string[]): boolean {
	const pattern = routeSegments(route);
	return pattern.length === segments.length && pattern.every((part, index) => isDynamicSegment(part) || part === segments[index]);
}

/**
 * The page route an tenant-relative path (`/rewards/abc/edit`, `/settings?tab=x`)
 * renders, or `undefined` when no tenant page serves it. Static routes win over
 * dynamic ones (`/rewards/new` is never `/rewards/[rewardId]`).
 */
export function resolveTenantPageRoute(tenantRelativePath: string): TenantPageRoute | undefined {
	const segments = routeSegments(tenantRelativePath);
	const matches = TenantPageRouteSchema.options.filter((route) => matchesRoutePattern(route, segments));
	return matches.find((route) => !route.includes("[")) ?? matches.at(0);
}

/** True when `rule` is open or its capability requirement is met by `isGranted`. */
export function isTenantPageRuleSatisfied(rule: TenantPageRule, isGranted: (capability: CapabilitySlug) => boolean): boolean {
	if (rule.kind === "open") {
		return true;
	}
	return evaluateSidebarAuthorization(rule.requirement, isGranted);
}

/** Whether `isGranted` may open the tenant page serving `tenantRelativePath`; fails closed for paths no page serves. */
export function canOpenTenantPath(tenantRelativePath: string, isGranted: (capability: CapabilitySlug) => boolean): boolean {
	const route = resolveTenantPageRoute(tenantRelativePath);
	return route !== undefined && isTenantPageRuleSatisfied(ORG_PAGE_RULES[route], isGranted);
}
