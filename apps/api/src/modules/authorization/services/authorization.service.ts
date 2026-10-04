import { Injectable } from "@nestjs/common";
import type { PermissionAction, PermissionResource } from "@workspace/shared";

import { AuthorizationCheckerService } from "./authorization-checker.service";
import { PermissionService } from "./permission.service";
import { RoleService } from "./role.service";

// ── Fluent user proxy ───────────────────────────────────────────────────────

/**
 * Fluent proxy returned by `authorization.user(id)`.
 *
 * Read-only, Spatie-like checks for a single user. Mutations are not offered
 * here: every RBAC change needs an authenticated actor and goes through
 * `RoleService` / `PermissionService` (escalation checks, audit, revocation).
 */
export class UserAuthorizationProxy {
	public constructor(
		private readonly userId: string,
		private readonly checker: AuthorizationCheckerService,
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
}

// ── Root facade ─────────────────────────────────────────────────────────────

/**
 * Top-level authorization facade:
 *
 * ```ts
 * const allowed = await authorization.user(userId).can("CREATE", "USER");
 * await authorization.roles.assignToUser(actor, userId, roleId); // actor-bearing, audited
 * ```
 */
@Injectable()
export class AuthorizationService {
	public constructor(
		private readonly checker: AuthorizationCheckerService,
		private readonly roleService: RoleService,
		private readonly permissionService: PermissionService,
	) {}

	/**
	 * Get a fluent proxy for a specific user's authorization.
	 */
	public user(userId: string): UserAuthorizationProxy {
		return new UserAuthorizationProxy(userId, this.checker);
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
