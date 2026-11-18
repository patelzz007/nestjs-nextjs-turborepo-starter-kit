import { z } from "zod";

import { PermissionActionSchema, PermissionResourceSchema, type PermissionAction, type PermissionResource } from "../contexts/authorization/schemas/permission-enums";
import { toPlatformCapabilitySlug, type CapabilitySlug } from "../contexts/authorization/schemas/capabilities";
import type { MembershipRole } from "../contexts/tenancy/schemas/tenant";

/**
 * Shared permission vocabulary for the frontend and backend.
 *
 * - `ACTION` / `RESOURCE` are the canonical enum values (`ACTION.DELETE`, `RESOURCE.ORDER`).
 * - `PERMISSION.<RESOURCE>.<ACTION>` is the capability slug the UI checks
 *   (`PERMISSION.ORDER.DELETE` → `"platform:order.delete"`).
 *
 * The database persists `(action, resource, scope)` rows; this module is the
 * only place application code should derive permission identifiers from, so
 * typos such as `"USER:DELTE"` fail at compile time instead of silently denying.
 */

export const ACTION: Readonly<Record<PermissionAction, PermissionAction>> = PermissionActionSchema.enum;

export const RESOURCE: Readonly<Record<PermissionResource, PermissionResource>> = PermissionResourceSchema.enum;

/** Capability slug per action for one resource. */
export type PermissionActionSlugs = Readonly<Record<PermissionAction, CapabilitySlug>>;

/** Full `PERMISSION.<RESOURCE>.<ACTION>` registry. */
export type PermissionRegistry = Readonly<Record<PermissionResource, PermissionActionSlugs>>;

function actionSlugs(resource: PermissionResource): PermissionActionSlugs {
	return {
		CREATE: toPlatformCapabilitySlug("CREATE", resource),
		READ: toPlatformCapabilitySlug("READ", resource),
		UPDATE: toPlatformCapabilitySlug("UPDATE", resource),
		DELETE: toPlatformCapabilitySlug("DELETE", resource),
		LIST: toPlatformCapabilitySlug("LIST", resource),
		PUBLISH: toPlatformCapabilitySlug("PUBLISH", resource),
		APPROVE: toPlatformCapabilitySlug("APPROVE", resource),
		REJECT: toPlatformCapabilitySlug("REJECT", resource),
		SUSPEND: toPlatformCapabilitySlug("SUSPEND", resource),
		BAN: toPlatformCapabilitySlug("BAN", resource),
		UNBAN: toPlatformCapabilitySlug("UNBAN", resource),
		REACTIVATE: toPlatformCapabilitySlug("REACTIVATE", resource),
		UNLOCK: toPlatformCapabilitySlug("UNLOCK", resource),
		REDEEM: toPlatformCapabilitySlug("REDEEM", resource),
	};
}

export const PERMISSION: PermissionRegistry = {
	USER: actionSlugs("USER"),
	PROFILE: actionSlugs("PROFILE"),
	ROLE: actionSlugs("ROLE"),
	PERMISSION: actionSlugs("PERMISSION"),
	ADMIN_DASHBOARD: actionSlugs("ADMIN_DASHBOARD"),
	SYSTEM_SETTINGS: actionSlugs("SYSTEM_SETTINGS"),
	ANALYTICS: actionSlugs("ANALYTICS"),
	AUDIT_LOG: actionSlugs("AUDIT_LOG"),
	REPORT: actionSlugs("REPORT"),
	EMAIL: actionSlugs("EMAIL"),
	GEO: actionSlugs("GEO"),
	REWARD: actionSlugs("REWARD"),
	MERCHANT_ORG: actionSlugs("MERCHANT_ORG"),
	REDEMPTION: actionSlugs("REDEMPTION"),
	SAMPLE_CATEGORY: actionSlugs("SAMPLE_CATEGORY"),
	PRODUCT: actionSlugs("PRODUCT"),
	DEVTOOLS: actionSlugs("DEVTOOLS"),
	ORDER: actionSlugs("ORDER"),
	PAYMENT: actionSlugs("PAYMENT"),
	INVENTORY: actionSlugs("INVENTORY"),
	TENANT: actionSlugs("TENANT"),
	LOCATION: actionSlugs("LOCATION"),
	GITHUB: actionSlugs("GITHUB"),
	GITHUB_PULL_REQUEST: actionSlugs("GITHUB_PULL_REQUEST"),
	KANBAN_TASK: actionSlugs("KANBAN_TASK"),
	KANBAN_BOARD: actionSlugs("KANBAN_BOARD"),
	SERVER_METRIC: actionSlugs("SERVER_METRIC"),
	DATABASE_BACKUP: actionSlugs("DATABASE_BACKUP"),
	LOAD_TEST: actionSlugs("LOAD_TEST"),
	NOTIFICATION: actionSlugs("NOTIFICATION"),
	BROADCAST: actionSlugs("BROADCAST"),
	BROADCAST_REPORT: actionSlugs("BROADCAST_REPORT"),
	RATE_LIMIT: actionSlugs("RATE_LIMIT"),
	CACHE: actionSlugs("CACHE"),
	BACKGROUND_JOB: actionSlugs("BACKGROUND_JOB"),
	STATUS_INCIDENT: actionSlugs("STATUS_INCIDENT"),
	FEATURE_FLAG: actionSlugs("FEATURE_FLAG"),
	DOCS_SYNC: actionSlugs("DOCS_SYNC"),
	MEMBER: actionSlugs("MEMBER"),
	KYB: actionSlugs("KYB"),
	ACCESS_REQUEST: actionSlugs("ACCESS_REQUEST"),
	SUPPORT_ACCESS: actionSlugs("SUPPORT_ACCESS"),
	API_KEY: actionSlugs("API_KEY"),
	INVITE: actionSlugs("INVITE"),
	SESSION: actionSlugs("SESSION"),
	CUSTOMER_BAN: actionSlugs("CUSTOMER_BAN"),
	SHARE: actionSlugs("SHARE"),
	CLAIM: actionSlugs("CLAIM"),
	TERMINAL: actionSlugs("TERMINAL"),
	WEBHOOK: actionSlugs("WEBHOOK"),
	FEATURE_FLAG_GROUP: actionSlugs("FEATURE_FLAG_GROUP"),
	DYNAMIC_CONFIG: actionSlugs("DYNAMIC_CONFIG"),
	EXPERIMENT: actionSlugs("EXPERIMENT"),
};

/**
 * Merchant-app capability slugs (tenant-scoped, granted per membership
 * role by the API's tenant policies). The merchant app's CASL ability is built
 * from them (`abilityRules(capabilities, "merchant")`), each one mapped
 * to its catalogue permission by `MERCHANT_CAPABILITY_PERMISSION` below, so a
 * check reads `ability.can("UPDATE", "REWARD")` or `<Can I="UPDATE" a="REWARD">`.
 *
 * Every merchant page, sidebar item, and API check is expressed with one of
 * these — never with a membership role name.
 */
export const MerchantCapabilitySchema = z.enum([
	"merchant:view_dashboard",
	"merchant:view_rewards",
	"merchant:manage_rewards",
	"merchant:view_redemptions",
	"merchant:manage_api_keys",
	"merchant:view_analytics",
	"merchant:manage_team",
	"merchant:view_locations",
	"merchant:manage_locations",
	"merchant:manage_verification",
	"merchant:view_notifications",
	"merchant:manage_broadcasts",
	"merchant:publish_broadcasts",
	"merchant:manage_payments",
	"merchant:manage_webhooks",
	// Read and write split per catalogue verb (ADR 090): a route checks exactly the verb of what it does.
	"merchant:create_rewards",
	"merchant:publish_rewards",
	"merchant:view_api_keys",
	"merchant:revoke_api_keys",
	"merchant:view_terminals",
	"merchant:manage_terminals",
	"merchant:remove_terminals",
	"merchant:view_team",
	"merchant:invite_members",
	"merchant:revoke_invites",
	"merchant:approve_access_requests",
	"merchant:reject_access_requests",
	"merchant:view_verification",
	"merchant:view_payments",
	"merchant:refund_payments",
	"merchant:view_webhooks",
	"merchant:create_webhooks",
	"merchant:delete_webhooks",
	"merchant:view_broadcasts",
	"merchant:create_broadcasts",
	"merchant:view_customer_bans",
	"merchant:ban_customers",
	"merchant:lift_customer_bans",
]);

export type MerchantCapability = z.output<typeof MerchantCapabilitySchema>;

export interface MerchantCapabilityRegistry {
	readonly viewDashboard: MerchantCapability;
	readonly viewRewards: MerchantCapability;
	readonly manageRewards: MerchantCapability;
	readonly viewRedemptions: MerchantCapability;
	readonly manageApiKeys: MerchantCapability;
	readonly viewAnalytics: MerchantCapability;
	/** Team roster, invitations, and revocations. */
	readonly manageTeam: MerchantCapability;
	/** Read the tenant's store locations (membership context — every member). */
	readonly viewLocations: MerchantCapability;
	/** Request / resubmit store locations and change store branding. */
	readonly manageLocations: MerchantCapability;
	/** Business verification (KYB): read, submit, and download documents. */
	readonly manageVerification: MerchantCapability;
	/** The tenant's own notification delivery log (ADR 070). */
	readonly viewNotifications: MerchantCapability;
	/** Draft, edit and submit broadcasts to the tenant's customers (ADR 073). */
	readonly manageBroadcasts: MerchantCapability;
	/** Approve another member's broadcast for sending (the second pair of eyes, ADR 073). */
	readonly publishBroadcasts: MerchantCapability;
	/** Ask for payments through the tenant's gateways, follow them and refund them (ADR 020). */
	readonly managePayments: MerchantCapability;
	/** Change the tenant's outgoing webhook endpoints, rotate their secrets, replay deliveries (ADR 082). */
	readonly manageWebhooks: MerchantCapability;
	/** Create a reward (draft). */
	readonly createRewards: MerchantCapability;
	/** Submit a reward for review to go live. */
	readonly publishRewards: MerchantCapability;
	/** See the tenant's API keys and the POS settings. */
	readonly viewApiKeys: MerchantCapability;
	/** Revoke an API key. */
	readonly revokeApiKeys: MerchantCapability;
	/** See the tenant's tills (terminals). */
	readonly viewTerminals: MerchantCapability;
	/** Register a till, issue its pairing code, rename it. */
	readonly manageTerminals: MerchantCapability;
	/** Remove a till. */
	readonly removeTerminals: MerchantCapability;
	/** See the team roster and pending invitations. */
	readonly viewTeam: MerchantCapability;
	/** Invite someone to the team. */
	readonly inviteMembers: MerchantCapability;
	/** Revoke a pending invitation. */
	readonly revokeInvites: MerchantCapability;
	/** Approve a request to join the team. */
	readonly approveAccessRequests: MerchantCapability;
	/** Reject a request to join the team. */
	readonly rejectAccessRequests: MerchantCapability;
	/** See the business verification (KYB) details and documents. */
	readonly viewVerification: MerchantCapability;
	/** See the tenant's payments. */
	readonly viewPayments: MerchantCapability;
	/** Refund a payment. */
	readonly refundPayments: MerchantCapability;
	/** See the tenant's outgoing webhook endpoints and deliveries. */
	readonly viewWebhooks: MerchantCapability;
	/** Add an outgoing webhook endpoint. */
	readonly createWebhooks: MerchantCapability;
	/** Delete an outgoing webhook endpoint. */
	readonly deleteWebhooks: MerchantCapability;
	/** See the tenant's broadcasts. */
	readonly viewBroadcasts: MerchantCapability;
	/** Draft a new broadcast. */
	readonly createBroadcasts: MerchantCapability;
	/** See the customers banned from the tenant's rewards. */
	readonly viewCustomerBans: MerchantCapability;
	/** Ban a customer from the tenant's rewards. */
	readonly banCustomers: MerchantCapability;
	/** Lift a customer ban. */
	readonly liftCustomerBans: MerchantCapability;
}

export const MERCHANT_CAPABILITY: MerchantCapabilityRegistry = {
	viewDashboard: "merchant:view_dashboard",
	viewRewards: "merchant:view_rewards",
	manageRewards: "merchant:manage_rewards",
	viewRedemptions: "merchant:view_redemptions",
	manageApiKeys: "merchant:manage_api_keys",
	viewAnalytics: "merchant:view_analytics",
	manageTeam: "merchant:manage_team",
	viewLocations: "merchant:view_locations",
	manageLocations: "merchant:manage_locations",
	manageVerification: "merchant:manage_verification",
	viewNotifications: "merchant:view_notifications",
	manageBroadcasts: "merchant:manage_broadcasts",
	publishBroadcasts: "merchant:publish_broadcasts",
	managePayments: "merchant:manage_payments",
	manageWebhooks: "merchant:manage_webhooks",
	createRewards: "merchant:create_rewards",
	publishRewards: "merchant:publish_rewards",
	viewApiKeys: "merchant:view_api_keys",
	revokeApiKeys: "merchant:revoke_api_keys",
	viewTerminals: "merchant:view_terminals",
	manageTerminals: "merchant:manage_terminals",
	removeTerminals: "merchant:remove_terminals",
	viewTeam: "merchant:view_team",
	inviteMembers: "merchant:invite_members",
	revokeInvites: "merchant:revoke_invites",
	approveAccessRequests: "merchant:approve_access_requests",
	rejectAccessRequests: "merchant:reject_access_requests",
	viewVerification: "merchant:view_verification",
	viewPayments: "merchant:view_payments",
	refundPayments: "merchant:refund_payments",
	viewWebhooks: "merchant:view_webhooks",
	createWebhooks: "merchant:create_webhooks",
	deleteWebhooks: "merchant:delete_webhooks",
	viewBroadcasts: "merchant:view_broadcasts",
	createBroadcasts: "merchant:create_broadcasts",
	viewCustomerBans: "merchant:view_customer_bans",
	banCustomers: "merchant:ban_customers",
	liftCustomerBans: "merchant:lift_customer_bans",
};

/**
 * Tenant Cedar action the API evaluates after the membership-role table for
 * each merchant capability (Cedar may only narrow the role table). `null`
 * marks a capability satisfied by tenant membership itself (the
 * dashboard, the store list, store branding reads); asking the API to enforce
 * one of those fails closed. A `Record`, so a new capability fails to compile
 * until it is mapped here. Shared by the tenants (capability gate) and
 * authorization (Cedar schema) contexts.
 */
export const MERCHANT_CAPABILITY_CEDAR_ACTIONS: Readonly<Record<MerchantCapability, string | null>> = {
	"merchant:view_dashboard": null,
	"merchant:view_rewards": "tenant:view_rewards",
	"merchant:manage_rewards": "tenant:manage_rewards",
	"merchant:view_redemptions": "tenant:view_redemptions",
	"merchant:manage_api_keys": "tenant:manage_api_keys",
	"merchant:view_analytics": "tenant:view_analytics",
	"merchant:manage_team": "tenant:manage_team",
	"merchant:view_locations": null,
	"merchant:manage_locations": "tenant:manage_locations",
	"merchant:manage_verification": "tenant:manage_verification",
	"merchant:view_notifications": "tenant:view_notifications",
	"merchant:manage_broadcasts": "tenant:manage_broadcasts",
	"merchant:publish_broadcasts": "tenant:publish_broadcasts",
	"merchant:manage_payments": "tenant:manage_payments",
	"merchant:manage_webhooks": "tenant:manage_webhooks",
	"merchant:create_rewards": "tenant:create_rewards",
	"merchant:publish_rewards": "tenant:publish_rewards",
	"merchant:view_api_keys": "tenant:view_api_keys",
	"merchant:revoke_api_keys": "tenant:revoke_api_keys",
	"merchant:view_terminals": "tenant:view_terminals",
	"merchant:manage_terminals": "tenant:manage_terminals",
	"merchant:remove_terminals": "tenant:remove_terminals",
	"merchant:view_team": "tenant:view_team",
	"merchant:invite_members": "tenant:invite_members",
	"merchant:revoke_invites": "tenant:revoke_invites",
	"merchant:approve_access_requests": "tenant:approve_access_requests",
	"merchant:reject_access_requests": "tenant:reject_access_requests",
	"merchant:view_verification": "tenant:view_verification",
	"merchant:view_payments": "tenant:view_payments",
	"merchant:refund_payments": "tenant:refund_payments",
	"merchant:view_webhooks": "tenant:view_webhooks",
	"merchant:create_webhooks": "tenant:create_webhooks",
	"merchant:delete_webhooks": "tenant:delete_webhooks",
	"merchant:view_broadcasts": "tenant:view_broadcasts",
	"merchant:create_broadcasts": "tenant:create_broadcasts",
	"merchant:view_customer_bans": "tenant:view_customer_bans",
	"merchant:ban_customers": "tenant:ban_customers",
	"merchant:lift_customer_bans": "tenant:lift_customer_bans",
};

export const PermissionPairSchema = z
	.object({
		action: PermissionActionSchema,
		resource: PermissionResourceSchema,
	})
	.strict();

export type PermissionPair = z.output<typeof PermissionPairSchema>;

/** `noun.verb` shorthand for the tables below. */
function pair(resource: PermissionResource, action: PermissionAction): PermissionPair {
	return { action, resource };
}

/**
 * The permissions a tenant can grant at all (ADR 067): every role, grant and share inside a tenant
 * draws from this list. The Owner template holds all of it; a platform permission never leaks into
 * a tenant role.
 */
export const TENANT_PERMISSIONS: readonly PermissionPair[] = [
	pair("TENANT", "READ"),
	pair("TENANT", "UPDATE"),
	pair("REWARD", "CREATE"),
	pair("REWARD", "READ"),
	pair("REWARD", "UPDATE"),
	pair("REWARD", "DELETE"),
	pair("REWARD", "PUBLISH"),
	pair("REDEMPTION", "READ"),
	pair("CLAIM", "READ"),
	pair("CLAIM", "REDEEM"),
	pair("ANALYTICS", "READ"),
	pair("LOCATION", "READ"),
	pair("LOCATION", "UPDATE"),
	pair("MEMBER", "READ"),
	pair("MEMBER", "UPDATE"),
	pair("MEMBER", "DELETE"),
	pair("INVITE", "CREATE"),
	pair("INVITE", "DELETE"),
	pair("ROLE", "CREATE"),
	pair("ROLE", "READ"),
	pair("ROLE", "UPDATE"),
	pair("ROLE", "DELETE"),
	pair("SHARE", "DELETE"),
	pair("API_KEY", "CREATE"),
	pair("API_KEY", "READ"),
	pair("API_KEY", "DELETE"),
	pair("TERMINAL", "CREATE"),
	pair("TERMINAL", "READ"),
	pair("TERMINAL", "DELETE"),
	pair("CUSTOMER_BAN", "CREATE"),
	pair("CUSTOMER_BAN", "READ"),
	pair("CUSTOMER_BAN", "DELETE"),
	pair("ACCESS_REQUEST", "APPROVE"),
	pair("ACCESS_REQUEST", "REJECT"),
	pair("KYB", "READ"),
	pair("KYB", "UPDATE"),
	pair("SUPPORT_ACCESS", "APPROVE"),
	// Broadcasts to the tenant's customers and the tenant's own delivery log (ADR 070, 073).
	pair("BROADCAST", "LIST"),
	pair("BROADCAST", "READ"),
	pair("BROADCAST", "CREATE"),
	pair("BROADCAST", "UPDATE"),
	pair("BROADCAST", "PUBLISH"),
	pair("BROADCAST", "DELETE"),
	pair("NOTIFICATION", "LIST"),
	// Payments through the tenant's gateways (ADR 020): ask for one, follow it, refund it.
	pair("PAYMENT", "LIST"),
	pair("PAYMENT", "READ"),
	pair("PAYMENT", "CREATE"),
	pair("PAYMENT", "UPDATE"),
	// Outgoing webhooks to the tenant's own systems (ADR 082): endpoints, their secrets and the delivery log.
	pair("WEBHOOK", "LIST"),
	pair("WEBHOOK", "READ"),
	pair("WEBHOOK", "CREATE"),
	pair("WEBHOOK", "UPDATE"),
	pair("WEBHOOK", "DELETE"),
];

/** Whether a permission is one a tenant may hold (see {@link TENANT_PERMISSIONS}). */
export function isTenantPermission(permission: PermissionPair): boolean {
	return TENANT_PERMISSIONS.some((candidate) => candidate.action === permission.action && candidate.resource === permission.resource);
}

/**
 * Permissions only the Owner template holds: the business's legal identity and who may reach its data — support
 * access, and outgoing webhooks, which send its events to systems outside the platform (ADR 082).
 */
const OWNER_ONLY_TENANT_PERMISSIONS: readonly PermissionPair[] = [
	pair("KYB", "UPDATE"),
	pair("SUPPORT_ACCESS", "APPROVE"),
	pair("TENANT", "UPDATE"),
	pair("WEBHOOK", "LIST"),
	pair("WEBHOOK", "READ"),
	pair("WEBHOOK", "CREATE"),
	pair("WEBHOOK", "UPDATE"),
	pair("WEBHOOK", "DELETE"),
];

function excluding(all: readonly PermissionPair[], removed: readonly PermissionPair[]): readonly PermissionPair[] {
	return all.filter((candidate) => !removed.some((gone) => gone.action === candidate.action && gone.resource === candidate.resource));
}

/**
 * The tenant-role templates (ADR 067). Each tenant gets its own editable copy when it is created; a
 * template change reaches new tenants only (and a tenant that resets a role to its template).
 *
 * - **Owner** runs the business: every tenant permission. Its copy can never be edited or deleted.
 * - **Manager** runs operations: everything except the Owner-only permissions.
 * - **Cashier** works the counter: reads what the till needs and redeems claims — no analytics,
 *   no team, no management.
 */
export const TENANT_ROLE_TEMPLATES: Readonly<Record<MembershipRole, readonly PermissionPair[]>> = {
	OWNER: TENANT_PERMISSIONS,
	MANAGER: excluding(TENANT_PERMISSIONS, OWNER_ONLY_TENANT_PERMISSIONS),
	CASHIER: [pair("TENANT", "READ"), pair("REWARD", "READ"), pair("REDEMPTION", "READ"), pair("CLAIM", "READ"), pair("CLAIM", "REDEEM"), pair("LOCATION", "READ")],
};

/** The display name of each template (and of a tenant's copy until it is renamed). */
export const TENANT_ROLE_TEMPLATE_NAMES: Readonly<Record<MembershipRole, string>> = {
	OWNER: "Owner",
	MANAGER: "Manager",
	CASHIER: "Cashier",
};

/**
 * The `noun.verb` permission behind each merchant-app capability slug. A bridge while the merchant
 * app still speaks capability slugs (ADR 067 Phase 3 moves it to `noun.verb`): the API checks the
 * permission, and the app shows what the member's effective permissions allow.
 */
export const MERCHANT_CAPABILITY_PERMISSION: Readonly<Record<MerchantCapability, PermissionPair>> = {
	"merchant:view_dashboard": pair("TENANT", "READ"),
	"merchant:view_rewards": pair("REWARD", "READ"),
	"merchant:manage_rewards": pair("REWARD", "UPDATE"),
	"merchant:view_redemptions": pair("REDEMPTION", "READ"),
	"merchant:manage_api_keys": pair("API_KEY", "CREATE"),
	"merchant:view_analytics": pair("ANALYTICS", "READ"),
	"merchant:manage_team": pair("MEMBER", "UPDATE"),
	"merchant:view_locations": pair("LOCATION", "READ"),
	"merchant:manage_locations": pair("LOCATION", "UPDATE"),
	"merchant:manage_verification": pair("KYB", "UPDATE"),
	"merchant:view_notifications": pair("NOTIFICATION", "LIST"),
	"merchant:manage_broadcasts": pair("BROADCAST", "UPDATE"),
	"merchant:publish_broadcasts": pair("BROADCAST", "PUBLISH"),
	"merchant:manage_payments": pair("PAYMENT", "CREATE"),
	"merchant:manage_webhooks": pair("WEBHOOK", "UPDATE"),
	"merchant:create_rewards": pair("REWARD", "CREATE"),
	"merchant:publish_rewards": pair("REWARD", "PUBLISH"),
	"merchant:view_api_keys": pair("API_KEY", "READ"),
	"merchant:revoke_api_keys": pair("API_KEY", "DELETE"),
	"merchant:view_terminals": pair("TERMINAL", "READ"),
	"merchant:manage_terminals": pair("TERMINAL", "CREATE"),
	"merchant:remove_terminals": pair("TERMINAL", "DELETE"),
	"merchant:view_team": pair("MEMBER", "READ"),
	"merchant:invite_members": pair("INVITE", "CREATE"),
	"merchant:revoke_invites": pair("INVITE", "DELETE"),
	"merchant:approve_access_requests": pair("ACCESS_REQUEST", "APPROVE"),
	"merchant:reject_access_requests": pair("ACCESS_REQUEST", "REJECT"),
	"merchant:view_verification": pair("KYB", "READ"),
	"merchant:view_payments": pair("PAYMENT", "READ"),
	"merchant:refund_payments": pair("PAYMENT", "UPDATE"),
	"merchant:view_webhooks": pair("WEBHOOK", "READ"),
	"merchant:create_webhooks": pair("WEBHOOK", "CREATE"),
	"merchant:delete_webhooks": pair("WEBHOOK", "DELETE"),
	"merchant:view_broadcasts": pair("BROADCAST", "READ"),
	"merchant:create_broadcasts": pair("BROADCAST", "CREATE"),
	"merchant:view_customer_bans": pair("CUSTOMER_BAN", "READ"),
	"merchant:ban_customers": pair("CUSTOMER_BAN", "CREATE"),
	"merchant:lift_customer_bans": pair("CUSTOMER_BAN", "DELETE"),
};

/** The merchant capability slugs a set of effective permissions satisfies (what the merchant app shows). */
export function merchantCapabilitiesOf(permissions: readonly PermissionPair[]): readonly MerchantCapability[] {
	return MerchantCapabilitySchema.options.filter((capability) => {
		const required = MERCHANT_CAPABILITY_PERMISSION[capability];
		return permissions.some((held) => held.action === required.action && held.resource === required.resource);
	});
}

const PLATFORM_SLUG_PATTERN = /^platform:([a-z0-9_]+)\.([a-z0-9_]+)$/;

/**
 * Parse a platform capability slug back into its `(action, resource)` pair.
 * Returns `null` for non-platform or unknown slugs (fail closed).
 */
export function parsePermissionSlug(slug: string): PermissionPair | null {
	const match = PLATFORM_SLUG_PATTERN.exec(slug);
	if (match === null) {
		return null;
	}
	const resourcePart = match.at(1);
	const actionPart = match.at(2);
	if (resourcePart === undefined || actionPart === undefined) {
		return null;
	}
	const parsed = PermissionPairSchema.safeParse({ action: actionPart.toUpperCase(), resource: resourcePart.toUpperCase() });
	return parsed.success ? parsed.data : null;
}

/**
 * Whether a held permission satisfies a required one: the same action on the same resource. There is
 * no catch-all action (ADR 067 retired `MANAGE`), so a role holds each verb it may use.
 */
export function permissionSatisfies(held: PermissionPair, required: PermissionPair): boolean {
	return held.resource === required.resource && held.action === required.action;
}

/**
 * Baseline grants every authenticated user holds on **their own** records
 * (OWN scope). This is the complete, explicit list — the kernel never infers
 * other self-service rights. Deleting or managing one's own account still
 * requires an assigned permission.
 */
export const IMPLICIT_SELF_GRANTS: readonly PermissionPair[] = [
	{ action: "READ", resource: "USER" },
	{ action: "UPDATE", resource: "USER" },
	{ action: "READ", resource: "PROFILE" },
	{ action: "UPDATE", resource: "PROFILE" },
];
