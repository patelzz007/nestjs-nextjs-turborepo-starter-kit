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
	"/broadcasts",
	"/broadcasts/new",
	"/broadcasts/[broadcastId]",
	"/broadcasts/[broadcastId]/edit",
	"/payments",
	"/payments/new",
	"/payments/[paymentId]",
	"/redemptions",
	"/analytics",
	"/terminals",
	"/api-keys",
	"/webhooks",
	"/webhooks/[endpointId]",
	"/webhooks/[endpointId]/edit",
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
	"/notifications",
	"/notifications/settings",
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

const VERIFICATION_DENIAL: TenantPageDenialCopy = {
	title: "Verification access required",
	description: "Your role can't see the business verification. It is submitted and updated by the tenant owner; contact them if details need to change.",
};

const BANNED_CUSTOMERS_DENIAL: TenantPageDenialCopy = {
	title: "Banned-customer access required",
	description: "Your role can't see the customers banned from your rewards. Contact your store owner if you need access.",
};

const WEBHOOKS_DENIAL: TenantPageDenialCopy = {
	title: "Webhook access required",
	description: "Webhooks send your store's events to your own systems. Only members allowed to see webhooks (owners, by default) can open them.",
};

const PAYMENTS_DENIAL: TenantPageDenialCopy = {
	title: "Payments access required",
	description: "Your role can't see or take payments. Contact your store owner if you need access.",
};

const BROADCASTS_DENIAL: TenantPageDenialCopy = {
	title: "Broadcasts access required",
	description: "Your role can't see or write messages to the store's customers. Contact your store owner if you need access.",
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
	// POST /t/:tenantSlug/rewards (merchant:create_rewards).
	"/rewards/new": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.createRewards] } },
	// GET /t/:tenantSlug/rewards (merchant:view_rewards) — the read-only reward page; its edit and submit actions need merchant:manage_rewards and merchant:publish_rewards in-page.
	"/rewards/[rewardId]": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewRewards] } },
	// PATCH /t/:tenantSlug/rewards/:rewardId (merchant:manage_rewards).
	"/rewards/[rewardId]/edit": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageRewards] } },
	// GET /tenants/:tenantSlug/broadcasts (merchant:view_broadcasts); drafting, editing and sending need their own capabilities in-page.
	"/broadcasts": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewBroadcasts] }, denial: BROADCASTS_DENIAL },
	// POST /tenants/:tenantSlug/broadcasts (merchant:create_broadcasts).
	"/broadcasts/new": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.createBroadcasts] }, denial: BROADCASTS_DENIAL },
	// GET /tenants/:tenantSlug/broadcasts/:broadcastId (merchant:view_broadcasts).
	"/broadcasts/[broadcastId]": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewBroadcasts] }, denial: BROADCASTS_DENIAL },
	// PUT /tenants/:tenantSlug/broadcasts/:broadcastId (merchant:manage_broadcasts).
	"/broadcasts/[broadcastId]/edit": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageBroadcasts] }, denial: BROADCASTS_DENIAL },
	// GET /tenants/:tenantSlug/payments (merchant:view_payments).
	"/payments": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewPayments] }, denial: PAYMENTS_DENIAL },
	// POST /tenants/:tenantSlug/payments (merchant:manage_payments).
	"/payments/new": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.managePayments] }, denial: PAYMENTS_DENIAL },
	// GET /tenants/:tenantSlug/payments/:paymentId (merchant:view_payments); its refund needs merchant:refund_payments in-page.
	"/payments/[paymentId]": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewPayments] }, denial: PAYMENTS_DENIAL },
	// GET /t/:tenantSlug/redemptions (merchant:view_redemptions).
	"/redemptions": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewRedemptions] } },
	// GET /t/:tenantSlug/analytics (merchant:view_analytics).
	"/analytics": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewAnalytics] } },
	// GET /t/:tenantSlug/terminals (merchant:view_terminals); registering and removing a till need their own capabilities in-page.
	"/terminals": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewTerminals] } },
	// GET /t/:tenantSlug/api-keys (merchant:view_api_keys); creating and revoking a key need their own capabilities in-page.
	"/api-keys": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewApiKeys] } },
	// GET /tenants/:tenantSlug/webhooks/** (merchant:view_webhooks, ADR 082); every change needs its own capability in-page.
	"/webhooks": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewWebhooks] }, denial: WEBHOOKS_DENIAL },
	"/webhooks/[endpointId]": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewWebhooks] }, denial: WEBHOOKS_DENIAL },
	// PATCH /tenants/:tenantSlug/webhooks/:endpointId (merchant:manage_webhooks).
	"/webhooks/[endpointId]/edit": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageWebhooks] }, denial: WEBHOOKS_DENIAL },
	// Settings index: reachable when at least one settings page is.
	"/settings": {
		kind: "capability",
		requirement: {
			permissions: [
				MERCHANT_CAPABILITY.viewTeam,
				MERCHANT_CAPABILITY.manageTeam,
				MERCHANT_CAPABILITY.viewLocations,
				MERCHANT_CAPABILITY.viewVerification,
				MERCHANT_CAPABILITY.viewCustomerBans,
				MERCHANT_CAPABILITY.viewApiKeys,
				MERCHANT_CAPABILITY.viewTerminals,
			],
			mode: "any",
		},
	},
	// GET /t/:tenantSlug/members[/invites] (merchant:view_team); inviting and revoking need their own capabilities in-page.
	"/settings/team": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewTeam] }, denial: TEAM_DENIAL },
	// /t/:tenantSlug/access/roles… (role.read / role.create / role.update — the API decides each).
	"/settings/team/roles": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageTeam] }, denial: TEAM_DENIAL },
	"/settings/team/roles/new": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageTeam] }, denial: TEAM_DENIAL },
	"/settings/team/roles/[roleId]": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageTeam] }, denial: TEAM_DENIAL },
	"/settings/team/roles/[roleId]/edit": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageTeam] }, denial: TEAM_DENIAL },
	// Counts of GET /t/:tenantSlug/terminals (merchant:view_terminals) and …/api-keys (merchant:view_api_keys): either one.
	"/settings/integrations": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewTerminals, MERCHANT_CAPABILITY.viewApiKeys], mode: "any" } },
	// /t/:tenantSlug/access/members/:membershipId… (member.read / member.update).
	"/settings/team/members/[membershipId]": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.manageTeam] }, denial: TEAM_DENIAL },
	// Reads the member-wide tenant context; requesting stores needs merchant:manage_locations in-page.
	"/settings/locations": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewLocations] } },
	// Reads the logo from the member-wide tenant context; uploading or removing it (POST /files, DELETE /files/:id) needs merchant:manage_locations in-page.
	"/settings/branding": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewLocations] } },
	// GET /t/:tenantSlug/kyb (merchant:view_verification); submitting (PATCH) needs merchant:manage_verification (the owner's) in-page.
	"/settings/verification": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewVerification] }, denial: VERIFICATION_DENIAL },
	// GET /t/:tenantSlug/customer-bans (merchant:view_customer_bans); lifting one needs merchant:lift_customer_bans in-page.
	"/settings/banned-customers": { kind: "capability", requirement: { permissions: [MERCHANT_CAPABILITY.viewCustomerBans] }, denial: BANNED_CUSTOMERS_DENIAL },
	"/account": { kind: "open", reason: "Personal account (password, 2FA, email) — restricted enrollment sessions must always reach it." },
	"/notifications": {
		kind: "open",
		reason: "The member's own merchant inbox (GET /notifications?surface=MERCHANT lists only the caller's notifications), whatever their role.",
	},
	"/notifications/settings": {
		kind: "open",
		reason: "The member's own notification settings (GET/PUT /notifications/preferences and friends act on the caller only), whatever their role.",
	},
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
