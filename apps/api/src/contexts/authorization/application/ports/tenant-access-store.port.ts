// ============================================
// application/ports/tenant-access-store.port.ts — the rows tenant access administration reads and writes (ADR 067)
// ============================================
// Dependency Inversion + Interface Segregation: the application service sees
// one transaction-scoped unit with exactly the operations it needs; Prisma
// implements it in infrastructure, tests in memory.

import type {
	EpochMs,
	MembershipRole,
	TenantMemberAccessResponse,
	PermissionPair,
	ShareableResource,
	ShareLevel,
	TenantGrantResponse,
	TenantRoleResponse,
	TenantShareResponse,
} from "@workspace/shared";

/** A member, as the guardrails see it. */
export interface TenantMemberRow {
	readonly id: string;
	readonly userId: string;
	readonly fullName: string;
	readonly email: string;
	readonly roleId: string;
	readonly templateKey: MembershipRole | null;
}

/** One audit row of the tenant's trail, written in the same transaction as the change. */
export interface TenantAccessAuditEntry {
	readonly action: string;
	readonly resourceType: string;
	readonly resourceId: string;
	readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

/** Everything one administration operation does, inside ONE transaction of one tenant. */
export interface TenantAccessUnit {
	roles(): Promise<readonly TenantRoleResponse[]>;
	role(roleId: string): Promise<TenantRoleResponse | null>;
	createRole(name: string, permissions: readonly PermissionPair[]): Promise<TenantRoleResponse>;
	updateRole(roleId: string, change: { readonly name?: string | undefined; readonly permissions?: readonly PermissionPair[] | undefined }): Promise<TenantRoleResponse>;
	deleteRole(roleId: string): Promise<void>;
	resetRole(roleId: string, template: MembershipRole): Promise<TenantRoleResponse>;
	/** The members holding a role, sorted by membership id. */
	holders(roleId: string): Promise<readonly TenantMemberRow[]>;

	member(membershipId: string): Promise<TenantMemberRow | null>;
	/** A member as the access screens show them (name, email, role, stores). */
	memberAccess(membershipId: string): Promise<TenantMemberAccessResponse | null>;
	/** The caller's own active membership in this tenant. */
	memberByUser(userId: string): Promise<TenantMemberRow | null>;
	ownerCount(): Promise<number>;
	setMemberRole(membershipId: string, roleId: string, template: MembershipRole | null): Promise<void>;
	removeMember(membershipId: string): Promise<void>;

	/** The member's grants still in force (permanent, or not yet ended). */
	grants(membershipId: string): Promise<readonly TenantGrantResponse[]>;
	grant(grantId: string): Promise<TenantGrantResponse | null>;
	createGrant(
		member: TenantMemberRow,
		grant: { readonly permission: PermissionPair; readonly locationId: string | null; readonly expiresAt: EpochMs | null; readonly grantedVia: string },
	): Promise<TenantGrantResponse>;
	revokeGrant(grantId: string): Promise<void>;

	/** The tenant's shares still in force. */
	shares(): Promise<readonly TenantShareResponse[]>;
	share(shareId: string): Promise<TenantShareResponse | null>;
	/** The stores a shareable record is limited to (none: the whole tenant), or `null` when the tenant has no such live record. */
	recordStores(resource: ShareableResource, resourceId: string): Promise<{ readonly locationIds: readonly string[] } | null>;
	createShare(share: {
		readonly resource: ShareableResource;
		readonly resourceId: string;
		readonly membershipId: string;
		readonly level: ShareLevel;
		readonly expiresAt: EpochMs | null;
	}): Promise<TenantShareResponse>;
	deleteShare(shareId: string): Promise<void>;

	audit(entry: TenantAccessAuditEntry): Promise<void>;
}

export interface TenantAccessStore {
	/** The live tenant a route's slug names, or `null`. */
	tenantIdBySlug(slug: string): Promise<string | null>;
	/** Runs `work` in one transaction of `tenantId`, attributing writes and audit rows to `actorUserId`. */
	run<TResult>(tenantId: string, actorUserId: string, work: (unit: TenantAccessUnit) => Promise<TResult>): Promise<TResult>;
}

export const TENANT_ACCESS_STORE = Symbol("TENANT_ACCESS_STORE");
