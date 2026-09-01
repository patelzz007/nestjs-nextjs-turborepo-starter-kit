import { Injectable, Logger } from "@nestjs/common";
import {
	nowEpochMs,
	type EpochMs,
	type PermissionAction,
	type PermissionResource,
	type PermissionDetailsResponse,
	type SlimRoleResponse,
	type UserPermissions,
	type CheckPermissionResponse,
} from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationCacheService, type CachedAuthorization, type CachedPermission } from "../cache/authorization-cache.service";

// ── Types ───────────────────────────────────────────────────────────────────

/** Requirement shape stored as route metadata by decorators. */
export interface PermissionRequirement {
	readonly action: PermissionAction;
	readonly resource: PermissionResource;
}

// ── Service ─────────────────────────────────────────────────────────────────

/**
 * Read-only authorization checker.
 *
 * Resolves a user's effective permissions from the cache (falling back to
 * a full DB query on miss) and evaluates whether a requirement is met.
 *
 * ## Wildcard semantics
 *
 * `MANAGE` on a resource grants every action on that resource.
 * A future extension could support `users.*` string patterns; for now the
 * enum-based model handles this natively via the `MANAGE` action.
 */
@Injectable()
export class AuthorizationCheckerService {
	private readonly logger: Logger = new Logger(AuthorizationCheckerService.name);

	public constructor(
		private readonly cache: AuthorizationCacheService,
		private readonly prisma: PrismaService,
	) {}

	// ── Permission checks ────────────────────────────────────────────────

	/**
	 * Check whether a user has a specific permission.
	 */
	public async hasPermission(userId: string, action: PermissionAction, resource: PermissionResource): Promise<boolean> {
		const auth: CachedAuthorization = await this.resolve(userId);
		return matchesPermission(auth.permissions, action, resource);
	}

	/**
	 * Check whether a user has ANY of the listed permissions (OR semantics).
	 */
	public async hasAnyPermission(userId: string, requirements: readonly { readonly action: PermissionAction; readonly resource: PermissionResource }[]): Promise<boolean> {
		const auth: CachedAuthorization = await this.resolve(userId);
		return requirements.some((r) => matchesPermission(auth.permissions, r.action, r.resource));
	}

	/**
	 * Check whether a user has ALL of the listed permissions (AND semantics).
	 */
	public async hasAllPermissions(userId: string, requirements: readonly { readonly action: PermissionAction; readonly resource: PermissionResource }[]): Promise<boolean> {
		const auth: CachedAuthorization = await this.resolve(userId);
		return requirements.every((r) => matchesPermission(auth.permissions, r.action, r.resource));
	}

	// ── Role checks ──────────────────────────────────────────────────────

	/**
	 * Check whether a user has a specific role.
	 */
	public async hasRole(userId: string, roleName: string): Promise<boolean> {
		const auth: CachedAuthorization = await this.resolve(userId);
		return auth.roles.includes(roleName);
	}

	/**
	 * Check whether a user has ANY of the listed roles (OR semantics).
	 */
	public async hasAnyRole(userId: string, roleNames: readonly string[]): Promise<boolean> {
		const auth: CachedAuthorization = await this.resolve(userId);
		return roleNames.some((name) => auth.roles.includes(name));
	}

	/**
	 * Check whether a user has ALL of the listed roles (AND semantics).
	 */
	public async hasAllRoles(userId: string, roleNames: readonly string[]): Promise<boolean> {
		const auth: CachedAuthorization = await this.resolve(userId);
		return roleNames.every((name) => auth.roles.includes(name));
	}

	/**
	 * Unified role check — accepts a mode to determine AND vs OR semantics.
	 *
	 * ```ts
	 * // User must have BOTH admin AND auditor roles
	 * await checker.hasRoles(userId, ["admin", "auditor"], "all");
	 *
	 * // User needs at least ONE of admin or manager
	 * await checker.hasRoles(userId, ["admin", "manager"], "any");
	 * ```
	 */
	public async hasRoles(userId: string, roleNames: readonly string[], mode: "all" | "any" = "all"): Promise<boolean> {
		return mode === "all" ? this.hasAllRoles(userId, roleNames) : this.hasAnyRole(userId, roleNames);
	}

	/**
	 * Unified permission check — accepts a mode to determine AND vs OR semantics.
	 *
	 * ```ts
	 * // User needs ALL of these permissions
	 * await checker.hasPermissions(userId, [
	 *   { action: "CREATE", resource: "USER" },
	 *   { action: "READ", resource: "ADMIN_DASHBOARD" },
	 * ], "all");
	 *
	 * // User needs ANY one of these permissions
	 * await checker.hasPermissions(userId, [
	 *   { action: "UPDATE", resource: "ROLE" },
	 *   { action: "UPDATE", resource: "PERMISSION" },
	 * ], "any");
	 * ```
	 */
	public async hasPermissions(
		userId: string,
		requirements: readonly { readonly action: PermissionAction; readonly resource: PermissionResource }[],
		mode: "all" | "any" = "all",
	): Promise<boolean> {
		return mode === "all" ? this.hasAllPermissions(userId, requirements) : this.hasAnyPermission(userId, requirements);
	}

	// ── Generic can() ────────────────────────────────────────────────────

	/**
	 * Generic authorization check — delegates to permission checks for now.
	 *
	 * Future: chain super-admin → permission → policy → resource ownership.
	 */
	public async can(userId: string, action: PermissionAction, resource: PermissionResource): Promise<boolean> {
		return this.hasPermission(userId, action, resource);
	}

	// ── Full permission details ──────────────────────────────────────────

	/**
	 * Resolve the full permission details for a user, including role
	 * metadata (id, name, description) and permission metadata (id,
	 * action, resource, description).
	 *
	 * This replaces `RbacService.getUserPermissions()` and returns the
	 * `UserPermissions` shape expected by `buildUserResponse()`.
	 */
	public async getUserDirectPermissionIds(userId: string): Promise<readonly string[]> {
		const nowMs: EpochMs = nowEpochMs();
		const rows = await this.prisma.userPermission.findMany({
			where: {
				userId,
				isDeleted: false,
				permission: { isDeleted: false },
				OR: [{ expiresAt: null }, { expiresAt: { gt: nowMs } }],
			},
			select: { permissionId: true },
		});
		return rows.map((row) => row.permissionId);
	}

	public async getUserPermissionDetails(userId: string): Promise<UserPermissions> {
		const nowMs: EpochMs = nowEpochMs();

		const userRoles = await this.prisma.userRole.findMany({
			where: { userId, isDeleted: false, role: { isDeleted: false, isActive: true } },
			include: {
				role: { select: { id: true, name: true, description: true, parentId: true } },
			},
		});

		const roles: SlimRoleResponse[] = userRoles.map((ur) => ({
			id: ur.role.id,
			name: ur.role.name,
			description: ur.role.description,
		}));

		const allRoleIds: Set<string> = await this.collectRoleHierarchyIds(userRoles.map((ur) => ({ id: ur.role.id, parentId: ur.role.parentId })));

		const rolePermissions = await this.prisma.rolePermission.findMany({
			where: {
				roleId: { in: Array.from(allRoleIds) },
				isDeleted: false,
				permission: { isDeleted: false },
			},
			include: { permission: { select: { id: true, action: true, resource: true, description: true, group: true } } },
		});

		const userPermissions = await this.prisma.userPermission.findMany({
			where: {
				userId,
				isDeleted: false,
				permission: { isDeleted: false },
				OR: [{ expiresAt: null }, { expiresAt: { gt: nowMs } }],
			},
			include: { permission: { select: { id: true, action: true, resource: true, description: true, group: true } } },
		});

		const permissionMap: Map<string, PermissionDetailsResponse> = new Map<string, PermissionDetailsResponse>();

		for (const rp of rolePermissions) {
			permissionMap.set(`${rp.permission.action}:${rp.permission.resource}`, {
				id: rp.permission.id,
				action: rp.permission.action,
				resource: rp.permission.resource,
				description: rp.permission.description,
				group: rp.permission.group ?? null,
			});
		}

		for (const up of userPermissions) {
			permissionMap.set(`${up.permission.action}:${up.permission.resource}`, {
				id: up.permission.id,
				action: up.permission.action,
				resource: up.permission.resource,
				description: up.permission.description,
				group: up.permission.group ?? null,
			});
		}

		return { roles, permissions: Array.from(permissionMap.values()) };
	}

	/**
	 * Check whether a user has a permission and explain which grants satisfy it.
	 *
	 * Used by the admin inspector (`POST /admin/permissions/check`).
	 */
	public async checkPermissionWithGrants(userId: string, action: PermissionAction, resource: PermissionResource): Promise<CheckPermissionResponse> {
		const user = await this.prisma.user.findFirst({
			where: { id: userId, isDeleted: false },
			select: { isSuperAdmin: true },
		});

		if (user === null) {
			return { allowed: false, grants: [] };
		}

		if (user.isSuperAdmin) {
			return {
				allowed: true,
				grants: [{ via: "super_admin", detail: "Platform super-admin flag (bypasses all permission checks)" }],
			};
		}

		const nowMs: EpochMs = nowEpochMs();
		const grants: CheckPermissionResponse["grants"] = [];
		const seenGrantKeys: Set<string> = new Set<string>();

		const pushGrant = (via: string, detail?: string): void => {
			const key = `${via}\0${detail ?? ""}`;
			if (seenGrantKeys.has(key)) {
				return;
			}
			seenGrantKeys.add(key);
			grants.push(detail !== undefined ? { via, detail } : { via });
		};

		const userPermissions = await this.prisma.userPermission.findMany({
			where: {
				userId,
				isDeleted: false,
				permission: { isDeleted: false },
				OR: [{ expiresAt: null }, { expiresAt: { gt: nowMs } }],
			},
			include: { permission: { select: { action: true, resource: true } } },
		});

		for (const up of userPermissions) {
			if (matchesPermission([{ action: up.permission.action, resource: up.permission.resource }], action, resource)) {
				const expiryDetail: string | undefined = up.expiresAt !== null ? `expiresAt:${String(up.expiresAt)}` : undefined;
				pushGrant("direct", expiryDetail ?? "Granted directly on this user");
			}
		}

		const userRoles = await this.prisma.userRole.findMany({
			where: { userId, isDeleted: false, role: { isDeleted: false, isActive: true } },
			include: { role: { select: { id: true, name: true, parentId: true } } },
		});

		const directRoleIds: Set<string> = new Set<string>(userRoles.map((ur) => ur.role.id));
		const directRoleNames: string[] = userRoles.map((ur) => ur.role.name);
		const allRoleIds: Set<string> = await this.collectRoleHierarchyIds(userRoles.map((ur) => ({ id: ur.role.id, parentId: ur.role.parentId })));

		const rolesById = await this.prisma.role.findMany({
			where: { id: { in: Array.from(allRoleIds) }, isDeleted: false },
			select: { id: true, name: true },
		});

		const roleNameById: Map<string, string> = new Map<string, string>(rolesById.map((r) => [r.id, r.name]));

		const rolePermissions = await this.prisma.rolePermission.findMany({
			where: {
				roleId: { in: Array.from(allRoleIds) },
				isDeleted: false,
				permission: { isDeleted: false },
			},
			include: { permission: { select: { action: true, resource: true } } },
		});

		for (const rp of rolePermissions) {
			if (!matchesPermission([{ action: rp.permission.action, resource: rp.permission.resource }], action, resource)) {
				continue;
			}
			const roleName: string = roleNameById.get(rp.roleId) ?? rp.roleId;
			if (directRoleIds.has(rp.roleId)) {
				pushGrant("role", `Assigned role: ${roleName}`);
			} else {
				const assignedLabel: string = directRoleNames.length > 0 ? directRoleNames.join(", ") : "assigned role";
				pushGrant("role", `Parent role in hierarchy: ${roleName} (via ${assignedLabel})`);
			}
		}

		return { allowed: grants.length > 0, grants };
	}

	// ── Resolution ───────────────────────────────────────────────────────

	/**
	 * Resolve the full authorization state for a user.
	 *
	 * 1. Check cache → return on hit.
	 * 2. Query DB (roles + role-permissions + direct permissions + role hierarchy).
	 * 3. Populate cache.
	 * 4. Return.
	 */
	private async resolve(userId: string): Promise<CachedAuthorization> {
		const cached: CachedAuthorization | null = this.cache.get(userId);
		if (cached !== null) {
			return cached;
		}

		const auth: CachedAuthorization = await this.loadFromDatabase(userId);
		this.cache.set(userId, auth);
		return auth;
	}

	/**
	 * Load authorization state from the database.
	 *
	 * Walks the role hierarchy to collect inherited permissions, merges
	 * direct user permissions, and deduplicates by action+resource.
	 */
	private async loadFromDatabase(userId: string): Promise<CachedAuthorization> {
		const nowMs: EpochMs = nowEpochMs();

		// 1. Fetch direct role assignments (skip soft-deleted)
		const userRoles = await this.prisma.userRole.findMany({
			where: {
				userId,
				isDeleted: false,
				role: { isDeleted: false, isActive: true },
			},
			include: {
				role: { select: { id: true, name: true, parentId: true } },
			},
		});

		const roleNames: string[] = userRoles.map((ur) => ur.role.name);

		// 2. Walk role hierarchy to collect all ancestor role IDs
		const allRoleIds: Set<string> = await this.collectRoleHierarchyIds(userRoles.map((ur) => ({ id: ur.role.id, parentId: ur.role.parentId })));

		// 3. Fetch role permissions for all collected roles
		const rolePermissions = await this.prisma.rolePermission.findMany({
			where: {
				roleId: { in: Array.from(allRoleIds) },
				isDeleted: false,
				permission: { isDeleted: false },
			},
			include: { permission: { select: { action: true, resource: true } } },
		});

		// 4. Fetch direct user permissions (not expired)
		const userPermissions = await this.prisma.userPermission.findMany({
			where: {
				userId,
				isDeleted: false,
				permission: { isDeleted: false },
				OR: [{ expiresAt: null }, { expiresAt: { gt: nowMs } }],
			},
			include: { permission: { select: { action: true, resource: true } } },
		});

		// 5. Deduplicate into a flat set
		const permissionMap: Map<string, CachedPermission> = new Map<string, CachedPermission>();

		for (const rp of rolePermissions) {
			const key = `${rp.permission.action}:${rp.permission.resource}`;
			permissionMap.set(key, {
				action: rp.permission.action,
				resource: rp.permission.resource,
			});
		}

		for (const up of userPermissions) {
			const key = `${up.permission.action}:${up.permission.resource}`;
			permissionMap.set(key, {
				action: up.permission.action,
				resource: up.permission.resource,
			});
		}

		return {
			roles: roleNames,
			permissions: Array.from(permissionMap.values()),
			cachedAt: nowMs,
		};
	}

	/**
	 * Walk the role hierarchy upward, collecting all ancestor role IDs.
	 */
	private async collectRoleHierarchyIds(start: readonly { readonly id: string; readonly parentId: string | null }[]): Promise<Set<string>> {
		const collected: Set<string> = new Set<string>();
		let frontier: readonly { readonly id: string; readonly parentId: string | null }[] = start;

		while (frontier.length > 0) {
			const parentIds: string[] = [];
			for (const role of frontier) {
				if (collected.has(role.id)) {
					continue;
				}
				collected.add(role.id);
				if (role.parentId !== null && !collected.has(role.parentId)) {
					parentIds.push(role.parentId);
				}
			}
			if (parentIds.length === 0) {
				break;
			}
			frontier = await this.prisma.role.findMany({
				where: { id: { in: parentIds }, isDeleted: false, isActive: true },
				select: { id: true, parentId: true },
			});
		}

		return collected;
	}
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Evaluate whether a set of cached permissions satisfies a requirement.
 *
 * ## Wildcard semantics
 *
 * 1. `MANAGE` on the same resource grants every action on that resource.
 * 2. `READ:USERS` satisfies `READ:USER` (resource prefix match).
 *    A user with `READ:USERS` can access any `USER` resource.
 *    This supports the `users.*` pattern from the permission registry.
 */
function matchesPermission(permissions: readonly CachedPermission[], action: PermissionAction, resource: PermissionResource): boolean {
	return permissions.some((p) => {
		if (p.action === "MANAGE" && p.resource === resource) {
			return true;
		}
		// Direct match
		if (p.action === action && p.resource === resource) {
			return true;
		}
		// Plural resource prefix match: READ:USERS satisfies READ:USER
		if (p.action === action && p.resource === `${resource}S`) {
			return true;
		}
		return false;
	});
}
