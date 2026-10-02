import { evaluateSidebarAuthorization } from "@workspace/client/lib/navigation/filter-sidebar-menu-by-capabilities";
import { MERCHANT_CAPABILITY, type CapabilitySlug, type MerchantCapability } from "@workspace/shared";
import { z } from "zod";

import { stripQueryAndHash } from "@/lib/routes";

/**
 * Every page under `app/orgs/[orgSlug]/`, as its org-relative route pattern
 * (dynamic segments keep their `[param]` folder name). A test fails when a
 * page exists without an entry here, when an entry has no page, or when a
 * page does not call `guardOrgPage` with its own pattern — so no org route
 * is ever silently unguarded.
 */
export const OrgPageRouteSchema = z.enum([
	"/",
	"/dashboard",
	"/rewards",
	"/rewards/new",
	"/rewards/[rewardId]/edit",
	"/redemptions",
	"/analytics",
	"/terminals",
	"/api-keys",
	"/settings",
	"/settings/team",
	"/settings/locations",
	"/settings/verification",
	"/account",
]);

export type OrgPageRoute = z.output<typeof OrgPageRouteSchema>;

/** Copy for the access-denied state of one page (defaults to the generic `MerchantAccessDenied` text). */
export interface OrgPageDenialCopy {
	readonly title: string;
	readonly description: string;
}

/** `merchant:*` capabilities a page needs — `any` (default) or `all` of them. */
export interface OrgPageRequirement {
	readonly permissions: readonly MerchantCapability[];
	readonly mode?: "any" | "all";
}

/** A page every member of the organization may open; `reason` documents why it carries no capability. */
export interface OpenOrgPageRule {
	readonly kind: "open";
	readonly reason: string;
}

/** A page gated by merchant capabilities — the same ones the API endpoints behind it enforce. */
export interface CapabilityOrgPageRule {
	readonly kind: "capability";
	readonly requirement: OrgPageRequirement;
	readonly denial?: OrgPageDenialCopy;
}

export type OrgPageRule = OpenOrgPageRule | CapabilityOrgPageRule;

const OWNER_ONLY_VERIFICATION_DENIAL: OrgPageDenialCopy = {
	title: "Owner access required",
	description: "Business verification is submitted and updated by the organization owner. Contact your store owner if details need to change.",
};

const TEAM_DENIAL: OrgPageDenialCopy = {
	title: "Team access required",
	description: "Your role can't view or manage team members. Contact your store owner if you need access.",
};

/**
 * Org route → capability map: the single authorization source for org pages,
 * the command palette and pinned items (the sidebar JSON carries the same
 * requirements, enforced by a test). UX only — the API stays authoritative.
 * Each rule names the API rule it mirrors.
 */
export const ORG_PAGE_RULES: Readonly<Record<OrgPageRoute, OrgPageRule>> = {
	"/": { kind: "open", reason: "Redirects to the dashboard, which is guarded itself." },
	// Organization summary from the member-wide GET /orgs/:orgSlug/context.
	"/dashboard": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewDashboard] } },
	// GET /orgs/:orgSlug/rewards (merchant:view_rewards).
	"/rewards": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewRewards] } },
	// POST /orgs/:orgSlug/rewards (merchant:manage_rewards).
	"/rewards/new": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageRewards] } },
	// Readable with merchant:view_rewards; the form is read-only without merchant:manage_rewards.
	"/rewards/[rewardId]/edit": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewRewards] } },
	// GET /orgs/:orgSlug/redemptions (merchant:view_redemptions).
	"/redemptions": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewRedemptions] } },
	// GET /orgs/:orgSlug/analytics (merchant:view_analytics).
	"/analytics": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewAnalytics] } },
	// /orgs/:orgSlug/terminals[/settings] (merchant:manage_api_keys — a paired till receives an API key).
	"/terminals": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageApiKeys] } },
	// /orgs/:orgSlug/api-keys (merchant:manage_api_keys).
	"/api-keys": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageApiKeys] } },
	// Settings index: reachable when at least one settings page is.
	"/settings": {
		kind: "capability",
		requirement: { permissions: [MERCHANT_CAPABILITY.manageTeam, MERCHANT_CAPABILITY.viewLocations, MERCHANT_CAPABILITY.manageVerification], mode: "any" },
	},
	// GET /orgs/:orgSlug/members[/invites], POST …/members/invite (merchant:manage_team).
	"/settings/team": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageTeam] }, denial: TEAM_DENIAL },
	// Reads the member-wide org context; requesting stores needs merchant:manage_locations in-page.
	"/settings/locations": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewLocations] } },
	// GET/PATCH /orgs/:orgSlug/kyb (merchant:manage_verification, owner-only).
	"/settings/verification": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageVerification] }, denial: OWNER_ONLY_VERIFICATION_DENIAL },
	"/account": { kind: "open", reason: "Personal account (password, 2FA, email) — restricted enrollment sessions must always reach it." },
};

function isDynamicSegment(segment: string): boolean {
	return segment.startsWith("[") && segment.endsWith("]");
}

function routeSegments(path: string): readonly string[] {
	return stripQueryAndHash(path)
		.split("/")
		.filter((segment) => segment.length > 0);
}

function matchesRoutePattern(route: OrgPageRoute, segments: readonly string[]): boolean {
	const pattern = routeSegments(route);
	return pattern.length === segments.length && pattern.every((part, index) => isDynamicSegment(part) || part === segments[index]);
}

/**
 * The page route an org-relative path (`/rewards/abc/edit`, `/settings?tab=x`)
 * renders, or `undefined` when no org page serves it. Static routes win over
 * dynamic ones (`/rewards/new` is never `/rewards/[rewardId]`).
 */
export function resolveOrgPageRoute(orgRelativePath: string): OrgPageRoute | undefined {
	const segments = routeSegments(orgRelativePath);
	const matches = OrgPageRouteSchema.options.filter((route) => matchesRoutePattern(route, segments));
	return matches.find((route) => !route.includes("[")) ?? matches.at(0);
}

/** True when `rule` is open or its capability requirement is met by `isGranted`. */
export function isOrgPageRuleSatisfied(rule: OrgPageRule, isGranted: (capability: CapabilitySlug) => boolean): boolean {
	if (rule.kind === "open") {
		return true;
	}
	return evaluateSidebarAuthorization(rule.requirement, isGranted);
}

/** Whether `isGranted` may open the org page serving `orgRelativePath`; fails closed for paths no page serves. */
export function canOpenOrgPath(orgRelativePath: string, isGranted: (capability: CapabilitySlug) => boolean): boolean {
	const route = resolveOrgPageRoute(orgRelativePath);
	return route !== undefined && isOrgPageRuleSatisfied(ORG_PAGE_RULES[route], isGranted);
}
