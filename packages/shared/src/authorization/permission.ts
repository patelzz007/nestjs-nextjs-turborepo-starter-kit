import { z } from "zod";

import { PermissionActionSchema, PermissionResourceSchema, type PermissionAction, type PermissionResource } from "../schemas/domain/platform/enums";
import { toPlatformCapabilitySlug, type CapabilitySlug } from "../schemas/domain/rbac/capabilities";
import type { OrganizationMembershipRole } from "../schemas/domain/organization/organization";

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
		MANAGE: toPlatformCapabilitySlug("MANAGE", resource),
	};
}

export const PERMISSION: PermissionRegistry = {
	USER: actionSlugs("USER"),
	PROFILE: actionSlugs("PROFILE"),
	ROLE: actionSlugs("ROLE"),
	PERMISSION: actionSlugs("PERMISSION"),
	ADMIN_DASHBOARD: actionSlugs("ADMIN_DASHBOARD"),
	SYSTEM_SETTINGS: actionSlugs("SYSTEM_SETTINGS"),
	URL: actionSlugs("URL"),
	TAG: actionSlugs("TAG"),
	API_KEY: actionSlugs("API_KEY"),
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
	ORGANIZATION: actionSlugs("ORGANIZATION"),
	LOCATION: actionSlugs("LOCATION"),
	STORE: actionSlugs("STORE"),
};

/**
 * Merchant-app capability slugs (organization-scoped, granted per membership
 * role by the API's tenant policies). Same `can()` / `<Can>` API as platform
 * permissions: `can(MERCHANT_CAPABILITY.manageRewards)`.
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
	/** Read the organization's store locations (membership context — every member). */
	readonly viewLocations: MerchantCapability;
	/** Request / resubmit store locations and change store branding. */
	readonly manageLocations: MerchantCapability;
	/** Business verification (KYB): read, submit, and download documents. */
	readonly manageVerification: MerchantCapability;
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
};

/**
 * Baseline merchant capabilities per organization membership role — the single
 * table both the API (before tenant Cedar policies, which may only narrow it)
 * and the merchant app derive from.
 *
 * - OWNER runs the business: everything, including business verification (KYB)
 * - ADMIN runs operations: everything except business verification
 * - CASHIER operates the counter: view rewards, redemptions, analytics, locations — no management
 * - POLICY_ADMIN administers tenant policies, not day-to-day operations
 * - MEMBER sees the dashboard and the store locations only
 */
const ALL_MERCHANT_CAPABILITIES: readonly MerchantCapability[] = MerchantCapabilitySchema.options;

/** KYB holds the business's legal and identity details — owner-only. */
const OWNER_ONLY_MERCHANT_CAPABILITIES: readonly MerchantCapability[] = [MERCHANT_CAPABILITY.manageVerification];

const MEMBER_MERCHANT_CAPABILITIES: readonly MerchantCapability[] = [MERCHANT_CAPABILITY.viewDashboard, MERCHANT_CAPABILITY.viewLocations];

export const MERCHANT_ROLE_CAPABILITIES: Readonly<Record<OrganizationMembershipRole, readonly MerchantCapability[]>> = {
	OWNER: ALL_MERCHANT_CAPABILITIES,
	ADMIN: ALL_MERCHANT_CAPABILITIES.filter((capability) => !OWNER_ONLY_MERCHANT_CAPABILITIES.includes(capability)),
	CASHIER: [
		MERCHANT_CAPABILITY.viewDashboard,
		MERCHANT_CAPABILITY.viewRewards,
		MERCHANT_CAPABILITY.viewRedemptions,
		MERCHANT_CAPABILITY.viewAnalytics,
		MERCHANT_CAPABILITY.viewLocations,
	],
	POLICY_ADMIN: MEMBER_MERCHANT_CAPABILITIES,
	MEMBER: MEMBER_MERCHANT_CAPABILITIES,
};

/** Whether a membership role holds a merchant capability (fails closed on unknown slugs). */
export function merchantRoleHasCapability(role: OrganizationMembershipRole, capability: string): boolean {
	const parsed = MerchantCapabilitySchema.safeParse(capability);
	return parsed.success && MERCHANT_ROLE_CAPABILITIES[role].includes(parsed.data);
}

export const PermissionPairSchema = z
	.object({
		action: PermissionActionSchema,
		resource: PermissionResourceSchema,
	})
	.strict();

export type PermissionPair = z.output<typeof PermissionPairSchema>;

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
 * Whether a held permission satisfies a required one. `MANAGE` on a resource
 * implies every action on that resource.
 */
export function permissionSatisfies(held: PermissionPair, required: PermissionPair): boolean {
	if (held.resource !== required.resource) {
		return false;
	}
	return held.action === required.action || held.action === "MANAGE";
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

/**
 * Server-evaluated capabilities attached to a single resource payload
 * (`order.authorization.can.delete`). Produced by the backend kernel so the
 * browser never re-implements scope, ACL, ownership, or policy rules.
 */
export const ResourceCapabilityMapSchema = z
	.object({
		create: z.boolean().optional(),
		read: z.boolean().optional(),
		update: z.boolean().optional(),
		delete: z.boolean().optional(),
		list: z.boolean().optional(),
		manage: z.boolean().optional(),
	})
	.strict();

export type ResourceCapabilityMap = z.output<typeof ResourceCapabilityMapSchema>;

export const ResourceAuthorizationSchema = z
	.object({
		can: ResourceCapabilityMapSchema,
	})
	.strict();

export type ResourceAuthorization = z.output<typeof ResourceAuthorizationSchema>;

/** Read one action from a server-provided capability map. */
export function readResourceCapability(capabilities: ResourceCapabilityMap, action: PermissionAction): boolean | undefined {
	switch (action) {
		case "CREATE":
			return capabilities.create;
		case "READ":
			return capabilities.read;
		case "UPDATE":
			return capabilities.update;
		case "DELETE":
			return capabilities.delete;
		case "LIST":
			return capabilities.list;
		case "MANAGE":
			return capabilities.manage;
	}
}

/** Build a capability map entry for one action. */
export function withResourceCapability(capabilities: ResourceCapabilityMap, action: PermissionAction, allowed: boolean): ResourceCapabilityMap {
	switch (action) {
		case "CREATE":
			return { ...capabilities, create: allowed };
		case "READ":
			return { ...capabilities, read: allowed };
		case "UPDATE":
			return { ...capabilities, update: allowed };
		case "DELETE":
			return { ...capabilities, delete: allowed };
		case "LIST":
			return { ...capabilities, list: allowed };
		case "MANAGE":
			return { ...capabilities, manage: allowed };
	}
}
