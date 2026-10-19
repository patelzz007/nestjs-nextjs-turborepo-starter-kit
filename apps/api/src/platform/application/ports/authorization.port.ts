import type { CapabilitySlug, OrganizationLocationScopeType, UserPermissions } from "@workspace/shared";

import type { ActorContext } from "../actor-context";

/** One resource-level check. `resourceId` is null when the action is not about one row. */
export interface AuthorizationCheck {
	readonly action: string;
	readonly resource: string;
	readonly resourceId: string | null;
}

/**
 * Resource-level authorization. `assertAllowed` throws {@link AuthorizationDeniedError}
 * (`PERMISSION_DENIED`, the code the kernel already returns).
 */
export interface AuthorizationPort {
	assertAllowed(actor: ActorContext, check: AuthorizationCheck): Promise<void>;
	can(actor: ActorContext, check: AuthorizationCheck): Promise<boolean>;
}

/** Merchant capability check. `locationId` narrows the check to one location when the capability is location-scoped. */
export interface MerchantAccessRequest {
	readonly organizationId: string;
	readonly capability: CapabilitySlug;
	readonly locationId?: string | null;
}

/** The caller's location scope inside the organization, as the membership already stores it. */
export interface MerchantAccessGrant {
	readonly organizationId: string;
	readonly locationScope: OrganizationLocationScopeType;
	readonly locationIds: readonly string[];
}

/** Merchant capability gate. Writes the same `authorize.*` organization audit rows as every merchant capability check. */
export interface MerchantAccessPort {
	assertCapability(actor: ActorContext, request: MerchantAccessRequest): Promise<MerchantAccessGrant>;
}

/** What a user holds, as the session payloads (`/auth/me`, `/auth/permissions`, tokens) show it. */
export interface UserGrantsReadPort {
	/** Roles and flattened permissions of the user. */
	getUserPermissionDetails(userId: string): Promise<UserPermissions>;
	/** Capability slugs the user holds (every slug for a platform SuperAdmin). */
	getUserCapabilitySlugs(userId: string): Promise<readonly CapabilitySlug[]>;
	/** Ids of the user's live direct ALLOW permissions. */
	getUserDirectPermissionIds(userId: string): Promise<readonly string[]>;
	/** Live roles of each user, in one batched read (admin user list). */
	listRolesOfUsers(userIds: readonly string[]): Promise<ReadonlyMap<string, readonly SlimRole[]>>;
}

/** A role as the admin user list shows it. */
export interface SlimRole {
	readonly id: string;
	readonly name: string;
	readonly description: string | null;
}

export const USER_GRANTS_READ = Symbol("USER_GRANTS_READ");
