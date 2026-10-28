import type {
	AdminPermissionResponse,
	AuditLogEntry,
	AuditLogQueryInput,
	CapabilityDefinition,
	CapabilityScope,
	PaginatedServiceResult,
	PermissionListItem,
	PermissionListQuery,
	RoleListItem,
	RoleListQuery,
	RoleResponse,
} from "@workspace/shared";

import type { ActorContext } from "../../../../platform/application/actor-context";

/** Catalog reads under the caller's RLS session (the route permission check has already run). */
export interface RbacCatalogReadPort {
	/** One page of the live permissions (by group, resource and action by default). */
	listPermissions(actor: ActorContext, query: PermissionListQuery): Promise<PaginatedServiceResult<PermissionListItem>>;
	findPermission(actor: ActorContext, permissionId: string): Promise<AdminPermissionResponse | null>;
	listPermissionGroups(actor: ActorContext): Promise<string[]>;
	/** One page of the live roles (by name by default). */
	listRoles(actor: ActorContext, query: RoleListQuery): Promise<PaginatedServiceResult<RoleListItem>>;
	findRole(actor: ActorContext, roleId: string): Promise<RoleResponse | null>;
}

/** A role set's active names and the `ACTION:RESOURCE` keys its roles confer. */
export interface EffectiveRoleSet {
	/** Names of the directly listed roles that are live and active (what the user "has"). */
	readonly roleNames: readonly string[];
	readonly permissionKeys: readonly string[];
}

/** A user's live, unexpired direct overrides as `ACTION:RESOURCE` keys. */
export interface DirectOverrideKeys {
	readonly allow: readonly string[];
	readonly deny: readonly string[];
}

/**
 * Dry-run reads of another user's assignments. `UserRole` / `UserPermission` are own-row RLS tables,
 * so every read runs under the allowlisted `authorization.rbac.inspect` operation, after the route check.
 */
export interface RbacInspectionReadPort {
	inspect<TResult>(actor: ActorContext, reason: string, work: (reader: RbacInspectionReader) => Promise<TResult>): Promise<TResult>;
}

export interface RbacInspectionReader {
	assignedRoleIds(userId: string): Promise<string[]>;
	activeRoleNames(roleIds: readonly string[]): Promise<ReadonlySet<string>>;
	effectiveRoleSet(roleIds: readonly string[]): Promise<EffectiveRoleSet>;
	directOverrideKeys(userId: string): Promise<DirectOverrideKeys>;
}

/** `GET /admin/audit`: `PermissionAuditLog` is bypass-only, read under `authorization.audit_log.read`. */
export interface PermissionAuditLogReadPort {
	list(actor: ActorContext, query: AuditLogQueryInput): Promise<PaginatedServiceResult<AuditLogEntry>>;
}

/** The generic capability catalog (`CapabilityDefinition`), cached per process and refreshed after the boot sync. */
export interface CapabilityCatalogReadPort {
	listCatalog(scope: CapabilityScope | undefined): Promise<CapabilityDefinition[]>;
	/** Drop the per-process copy (after `SyncCapabilityCatalog` committed). */
	invalidate(): void;
}

/** The tenant `AuthorizationGuard` verified for this request (ADR 017), never ids from the query string. */
export interface VerifiedRequestTenant {
	readonly tenantId?: string;
	readonly locationId?: string;
}

export interface RequestTenantPort {
	current(): VerifiedRequestTenant;
}
