import { Injectable, Logger } from "@nestjs/common";
import type { PermissionAction, PermissionResource } from "@workspace/shared";

import { AuthorizationCheckerService } from "./authorization-checker.service";
import { PermissionService } from "./permission.service";
import { RoleService } from "./role.service";

// ── Fluent user proxy ───────────────────────────────────────────────────────

/**
 * Fluent proxy returned by `authorization.user(id)`.
 *
 * Provides a Spatie-like API for checking and mutating a single user's
 * authorization state.
 */
export class UserAuthorizationProxy {
	private readonly logger: Logger = new Logger(UserAuthorizationProxy.name);

	public constructor(
		private readonly userId: string,
		private readonly checker: AuthorizationCheckerService,
		private readonly roleService: RoleService,
		private readonly permissionService: PermissionService,
	) {}

	// ── Permission checks ────────────────────────────────────────────────

	public async hasPermissionTo(action: PermissionAction, resource: PermissionResource): Promise<boolean> {
		return this.checker.hasPermission(this.userId, action, resource);
	}

	public async hasAnyPermission(requirements: readonly { readonly action: PermissionAction; readonly resource: PermissionResource }[]): Promise<boolean> {
		return this.checker.hasAnyPermission(this.userId, requirements);
	}

	public async hasAllPermissions(requirements: readonly { readonly action: PermissionAction; readonly resource: PermissionResource }[]): Promise<boolean> {
		return this.checker.hasAllPermissions(this.userId, requirements);
	}

	public async can(action: PermissionAction, resource: PermissionResource): Promise<boolean> {
		return this.checker.can(this.userId, action, resource);
	}

	// ── Role checks ──────────────────────────────────────────────────────

	public async hasRole(roleName: string): Promise<boolean> {
		return this.checker.hasRole(this.userId, roleName);
	}

	public async hasAnyRole(roleNames: readonly string[]): Promise<boolean> {
		return this.checker.hasAnyRole(this.userId, roleNames);
	}

	public async hasAllRoles(roleNames: readonly string[]): Promise<boolean> {
		return this.checker.hasAllRoles(this.userId, roleNames);
	}

	/**
	 * Unified role check with mode ("all" | "any").
	 *
	 * ```ts
	 * await authorization.user(id).hasRoles(["admin", "auditor"], "all");
	 * await authorization.user(id).hasRoles(["admin", "manager"], "any");
	 * ```
	 */
	public async hasRoles(roleNames: readonly string[], mode: "all" | "any" = "all"): Promise<boolean> {
		return this.checker.hasRoles(this.userId, roleNames, mode);
	}

	/**
	 * Unified permission check with mode ("all" | "any").
	 *
	 * ```ts
	 * await authorization.user(id).hasPermissions([
	 *   { action: "CREATE", resource: "USER" },
	 *   { action: "READ", resource: "ADMIN_DASHBOARD" },
	 * ], "all");
	 * ```
	 */
	public async hasPermissions(
		requirements: readonly { readonly action: PermissionAction; readonly resource: PermissionResource }[],
		mode: "all" | "any" = "all",
	): Promise<boolean> {
		return this.checker.hasPermissions(this.userId, requirements, mode);
	}

	// ── Role mutations ───────────────────────────────────────────────────

	public async assignRole(roleName: string): Promise<void> {
		const role = await this.roleService.findByName(roleName);
		if (role === null) {
			throw new Error(`Role "${roleName}" not found`);
		}
		await this.roleService.assignToUser(this.userId, role.id);
		this.logger.debug(`Assigned role "${roleName}" to user ${this.userId}`);
	}

	public async removeRole(roleName: string): Promise<void> {
		const role = await this.roleService.findByName(roleName);
		if (role === null) {
			return;
		}
		await this.roleService.removeFromUser(this.userId, role.id);
		this.logger.debug(`Removed role "${roleName}" from user ${this.userId}`);
	}

	public async syncRoles(roleNames: readonly string[]): Promise<void> {
		// Batch lookup — single query instead of N+1
		const roles = await this.roleService.findByNames([...roleNames]);
		const roleIds: string[] = roles.map((r) => r.id);
		await this.roleService.syncUserRoles(this.userId, roleIds);
		this.logger.debug(`Synced ${String(roleNames.length)} role(s) for user ${this.userId}`);
	}

	// ── Direct permission mutations ──────────────────────────────────────

	public async givePermissionTo(action: PermissionAction, resource: PermissionResource): Promise<void> {
		const permission = await this.permissionService.findByActionResource(action, resource);
		if (permission === null) {
			throw new Error(`Permission ${action}:${resource} not found`);
		}
		await this.permissionService.giveToUser(this.userId, permission.id);
		this.logger.debug(`Gave ${action}:${resource} to user ${this.userId}`);
	}

	public async revokePermissionTo(action: PermissionAction, resource: PermissionResource): Promise<void> {
		const permission = await this.permissionService.findByActionResource(action, resource);
		if (permission === null) {
			return;
		}
		await this.permissionService.revokeFromUser(this.userId, permission.id);
		this.logger.debug(`Revoked ${action}:${resource} from user ${this.userId}`);
	}
}

// ── Fluent role proxy ───────────────────────────────────────────────────────

/**
 * Fluent proxy returned by `authorization.role(name)`.
 */
export class RoleAuthorizationProxy {
	private readonly logger: Logger = new Logger(RoleAuthorizationProxy.name);

	public constructor(
		private readonly roleName: string,
		private readonly roleService: RoleService,
		private readonly permissionService: PermissionService,
	) {}

	public async givePermissionTo(action: PermissionAction, resource: PermissionResource): Promise<void> {
		const role = await this.roleService.findByName(this.roleName);
		if (role === null) {
			throw new Error(`Role "${this.roleName}" not found`);
		}
		const perm = await this.permissionService.findByActionResource(action, resource);
		if (perm === null) {
			throw new Error(`Permission ${action}:${resource} not found`);
		}
		await this.roleService.givePermissionTo(role.id, perm.id);
		this.logger.debug(`Gave ${action}:${resource} to role "${this.roleName}"`);
	}

	public async revokePermissionTo(action: PermissionAction, resource: PermissionResource): Promise<void> {
		const role = await this.roleService.findByName(this.roleName);
		if (role === null) {
			return;
		}
		const perm = await this.permissionService.findByActionResource(action, resource);
		if (perm === null) {
			return;
		}
		await this.roleService.revokePermissionFrom(role.id, perm.id);
		this.logger.debug(`Revoked ${action}:${resource} from role "${this.roleName}"`);
	}

	public async syncPermissions(permissions: readonly { readonly action: PermissionAction; readonly resource: PermissionResource }[]): Promise<void> {
		const role = await this.roleService.findByName(this.roleName);
		if (role === null) {
			throw new Error(`Role "${this.roleName}" not found`);
		}
		// Batch lookup — single query instead of N+1
		const allPerms = await this.permissionService.findAll({ limit: 1000 });
		const permMap = new Map<string, string>(allPerms.items.map((p) => [`${p.action}:${p.resource}`, p.id]));
		const permissionIds: string[] = permissions.map((p) => permMap.get(`${p.action}:${p.resource}`)).filter((id): id is string => id !== undefined);
		await this.roleService.syncPermissions(role.id, permissionIds);
		this.logger.debug(`Synced ${String(permissions.length)} permission(s) for role "${this.roleName}"`);
	}
}

// ── Root facade ─────────────────────────────────────────────────────────────

/**
 * Top-level authorization facade — the entry point for all authorization
 * operations.  Mirrors the Spatie-like developer experience:
 *
 * ```ts
 * await authorization.user(userId).assignRole("admin");
 * await authorization.role("admin").givePermissionTo("users.create");
 * const allowed = await authorization.user(userId).can("users.create");
 * ```
 */
@Injectable()
export class AuthorizationService {
	private readonly logger: Logger = new Logger(AuthorizationService.name);

	public constructor(
		private readonly checker: AuthorizationCheckerService,
		private readonly roleService: RoleService,
		private readonly permissionService: PermissionService,
	) {}

	/**
	 * Get a fluent proxy for a specific user's authorization.
	 */
	public user(userId: string): UserAuthorizationProxy {
		return new UserAuthorizationProxy(userId, this.checker, this.roleService, this.permissionService);
	}

	/**
	 * Get a fluent proxy for a specific role's permission management.
	 */
	public role(roleName: string): RoleAuthorizationProxy {
		return new RoleAuthorizationProxy(roleName, this.roleService, this.permissionService);
	}

	// ── Convenience re-exports ───────────────────────────────────────────

	/**
	 * Expose the underlying services for controllers that need
	 * direct access (admin CRUD endpoints, etc.).
	 */
	public get roles(): RoleService {
		return this.roleService;
	}

	public get permissions(): PermissionService {
		return this.permissionService;
	}

	public get checkerService(): AuthorizationCheckerService {
		return this.checker;
	}
}
