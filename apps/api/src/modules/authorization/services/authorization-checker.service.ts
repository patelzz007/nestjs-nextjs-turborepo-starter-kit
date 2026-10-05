import { Injectable } from "@nestjs/common";
import type { AclEffect, Prisma } from "@prisma/client";
import {
	nowEpochMs,
	type EpochMs,
	type PermissionAction,
	type PermissionResource,
	type PermissionDetailsResponse,
	type SlimRoleResponse,
	type UserPermissions,
	type CheckPermissionResponse,
	PermissionActionSchema,
	PermissionResourceSchema,
	type CapabilitySlug,
	CapabilitySlugSchema,
	toPlatformCapabilitySlug,
} from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationCacheService, type CachedAuthorization, type CachedPermission } from "../cache/authorization-cache.service";
import { collectRoleHierarchy } from "../kernel/subject-grants.loader";

// ── Types ───────────────────────────────────────────────────────────────────

/** Permission columns every grant query reads (the superset the callers below need). */
const GRANT_PERMISSION_SELECT = { id: true, action: true, resource: true, description: true, group: true } satisfies Prisma.PermissionSelect;

interface GrantRows {
	readonly userRoles: Prisma.UserRoleGetPayload<{ include: { role: { select: { id: true; name: true; description: true; parentId: true } } } }>[];
	/** Directly assigned + inherited (ancestor) active role ids. */
	readonly roleIds: string[];
	readonly rolePermissions: Prisma.RolePermissionGetPayload<{ include: { permission: { select: typeof GRANT_PERMISSION_SELECT } } }>[];
	readonly userPermissions: Prisma.UserPermissionGetPayload<{ include: { permission: { select: typeof GRANT_PERMISSION_SELECT } } }>[];
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
	public constructor(
		private readonly cache: AuthorizationCacheService,
		private readonly prisma: PrismaService,
	) {}

	/** Flat capability slug list for FE gating (`GET /auth/permissions`). */
	public async getUserCapabilitySlugs(userId: string): Promise<readonly CapabilitySlug[]> {
		// Platform SuperAdmins bypass every backend check, so the UI must not hide what they can do.
		const user = await this.prisma.user.findFirst({ where: { id: userId, isDeleted: false }, select: { isSuperAdmin: true } });
		if (user?.isSuperAdmin === true) {
			return allPlatformCapabilitySlugs();
		}
		const auth: CachedAuthorization = await this.resolve(userId);
		const slugs: CapabilitySlug[] = [];
		for (const entry of auth.capabilities) {
			const parsed = CapabilitySlugSchema.safeParse(entry);
			if (parsed.success) {
				slugs.push(parsed.data);
			}
		}
		return slugs;
	}

	// ── Full permission details ──────────────────────────────────────────

	/** Ids of the user's live direct ALLOW grants. */
	public async getUserDirectPermissionIds(userId: string): Promise<readonly string[]> {
		const rows = await this.prisma.userPermission.findMany({
			where: liveUserPermissionWhere(userId, "ALLOW", nowEpochMs()),
			select: { permissionId: true },
		});
		return rows.map((row) => row.permissionId);
	}

	/**
	 * Resolve the full permission details for a user, including role
	 * metadata (id, name, description) and permission metadata (id,
	 * action, resource, description).
	 *
	 * This replaces `RbacService.getUserPermissions()` and returns the
	 * `UserPermissions` shape expected by `buildUserResponse()`.
	 */
	public async getUserPermissionDetails(userId: string): Promise<UserPermissions> {
		const { userRoles, rolePermissions, userPermissions } = await this.loadGrantRows(userId, nowEpochMs());

		const roles: SlimRoleResponse[] = userRoles.map((ur) => ({
			id: ur.role.id,
			name: ur.role.name,
			description: ur.role.description,
		}));

		const permissionMap: Map<string, PermissionDetailsResponse> = new Map<string, PermissionDetailsResponse>();
		for (const { permission } of [...rolePermissions, ...userPermissions]) {
			permissionMap.set(`${permission.action}:${permission.resource}`, {
				id: permission.id,
				action: permission.action,
				resource: permission.resource,
				description: permission.description,
				group: permission.group ?? null,
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

		const { userRoles, roleIds, rolePermissions, userPermissions } = await this.loadGrantRows(userId, nowEpochMs());

		for (const up of userPermissions) {
			if (matchesPermission([{ action: up.permission.action, resource: up.permission.resource }], action, resource)) {
				const expiryDetail: string | undefined = up.expiresAt !== null ? `expiresAt:${String(up.expiresAt)}` : undefined;
				pushGrant("direct", expiryDetail ?? "Granted directly on this user");
			}
		}

		const directRoleIds: Set<string> = new Set<string>(userRoles.map((ur) => ur.role.id));
		const directRoleNames: string[] = userRoles.map((ur) => ur.role.name);

		const rolesById = await this.prisma.role.findMany({
			where: { id: { in: roleIds }, isDeleted: false },
			select: { id: true, name: true },
		});

		const roleNameById: Map<string, string> = new Map<string, string>(rolesById.map((r) => [r.id, r.name]));

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
	 * The user's active direct roles, every role id in their hierarchy, the
	 * live permissions of those roles, and the user's live direct ALLOW grants.
	 */
	private async loadGrantRows(userId: string, nowMs: EpochMs): Promise<GrantRows> {
		const userRoles = await this.prisma.userRole.findMany({
			where: { userId, isDeleted: false, role: { isDeleted: false, isActive: true } },
			include: { role: { select: { id: true, name: true, description: true, parentId: true } } },
		});

		const roleIds: string[] = await collectRoleHierarchy(
			this.prisma,
			userRoles.map((ur) => ({ id: ur.role.id, parentId: ur.role.parentId })),
		);

		const rolePermissions = await this.prisma.rolePermission.findMany({
			where: { roleId: { in: roleIds }, isDeleted: false, permission: { isDeleted: false } },
			include: { permission: { select: GRANT_PERMISSION_SELECT } },
		});

		const userPermissions = await this.prisma.userPermission.findMany({
			where: liveUserPermissionWhere(userId, "ALLOW", nowMs),
			include: { permission: { select: GRANT_PERMISSION_SELECT } },
		});

		return { userRoles, roleIds, rolePermissions, userPermissions };
	}

	/**
	 * Load authorization state from the database.
	 *
	 * Walks the role hierarchy to collect inherited permissions, merges
	 * direct user permissions, and deduplicates by action+resource.
	 */
	private async loadFromDatabase(userId: string): Promise<CachedAuthorization> {
		const nowMs: EpochMs = nowEpochMs();
		const { userRoles, rolePermissions, userPermissions } = await this.loadGrantRows(userId, nowMs);

		// Deduplicate role + direct grants into a flat set
		const permissionMap: Map<string, CachedPermission> = new Map<string, CachedPermission>();
		for (const { permission } of [...rolePermissions, ...userPermissions]) {
			permissionMap.set(`${permission.action}:${permission.resource}`, { action: permission.action, resource: permission.resource });
		}

		// Explicit DENY overrides remove the permission (DENY on MANAGE removes the whole resource).
		const deniedOverrides = await this.prisma.userPermission.findMany({
			where: liveUserPermissionWhere(userId, "DENY", nowMs),
			select: { permission: { select: { action: true, resource: true } } },
		});
		for (const [key, permission] of permissionMap) {
			const denied = deniedOverrides.some(
				(override) => override.permission.resource === permission.resource && (override.permission.action === permission.action || override.permission.action === "MANAGE"),
			);
			if (denied) {
				permissionMap.delete(key);
			}
		}

		const capabilitySet = new Set<string>();
		for (const permission of permissionMap.values()) {
			const actionParsed = PermissionActionSchema.safeParse(permission.action);
			const resourceParsed = PermissionResourceSchema.safeParse(permission.resource);
			if (actionParsed.success && resourceParsed.success) {
				capabilitySet.add(toPlatformCapabilitySlug(actionParsed.data, resourceParsed.data));
			}
		}

		return {
			roles: userRoles.map((ur) => ur.role.name),
			permissions: Array.from(permissionMap.values()),
			capabilities: Array.from(capabilitySet.values()),
			cachedAt: nowMs,
		};
	}
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** A user's live direct grants of one effect: not deleted, permission not deleted, not expired. */
function liveUserPermissionWhere(userId: string, effect: AclEffect, nowMs: EpochMs): Prisma.UserPermissionWhereInput {
	return {
		userId,
		isDeleted: false,
		effect,
		permission: { isDeleted: false },
		OR: [{ expiresAt: null }, { expiresAt: { gt: nowMs } }],
	};
}

/** Every platform capability (`resource × action`) — the SuperAdmin capability set. */
function allPlatformCapabilitySlugs(): CapabilitySlug[] {
	return PermissionResourceSchema.options.flatMap((resource) => PermissionActionSchema.options.map((action) => toPlatformCapabilitySlug(action, resource)));
}

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
