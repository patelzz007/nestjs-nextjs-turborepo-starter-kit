import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";

import type { AuthenticatedUser } from "../../../types/authenticated-user";
import { isAuthenticatedUser } from "../../../types/authenticated-user";
import { PrismaService } from "../../../prisma/prisma.service";

import { AuthorizationAuditService } from "../audit/authorization-audit.service";
import {
	REQUIRED_PERMISSION_KEY,
	REQUIRED_PERMISSIONS_KEY,
	REQUIRED_ROLES_KEY,
	type RequiredPermission,
	type RequiredPermissionsMetadata,
	type RequiredRolesMetadata,
} from "../constants/authorization.constants";
import { AuthorizationKernelService } from "../kernel/authorization-kernel.service";
import type { AuthorizationDecision } from "@workspace/shared";

/**
 * **Kernel-First Authorization Guard**
 *
 * Unified authorization guard powered exclusively by the Authorization Kernel.
 * Handles all authorization decorators through a single kernel-based path.
 *
 * ## Features
 * - Single authorization path (no branching/fallback)
 * - Kernel-powered permission checks
 * - Super-admin bypass with audit trail
 * - Token version validation
 * - Automatic admin access computation
 *
 * ## Supported Decorators
 * - `@RequirePermission(action, resource)` - single permission
 * - `@RequireAllPermissions(...)` - AND semantics
 * - `@RequireAnyPermission(...)` - OR semantics
 * - `@RequireAllRoles(...)` - role AND semantics
 * - `@RequireAnyRole(...)` - role OR semantics
 *
 * ## Authorization Flow
 * 1. Extract metadata from decorators
 * 2. Authenticate user from JWT
 * 3. Validate token version
 * 4. Super-admin bypass (with audit)
 * 5. Kernel authorization check
 * 6. Compute admin access for downstream guards
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
	private readonly logger: Logger = new Logger(AuthorizationGuard.name);

	public constructor(
		private readonly reflector: Reflector,
		private readonly kernel: AuthorizationKernelService,
		private readonly audit: AuthorizationAuditService,
		private readonly prisma: PrismaService,
	) {
		this.logger.log("AuthorizationGuard initialized (kernel-first)");
	}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		// ── 1. Read authorization metadata ─────────────────────────────────
		const legacyPermission = this.getLegacyPermission(context);
		const permissionsMeta = this.getPermissionsMeta(context);
		const rolesMeta = this.getRolesMeta(context);

		// No authorization metadata → public route
		if (!legacyPermission && !permissionsMeta && !rolesMeta) {
			await this.ensureAdminAccess(context);
			return true;
		}

		// ── 2. Extract authenticated user ──────────────────────────────────
		const request = context.switchToHttp().getRequest<FastifyRequest>();
		const user = request.user;

		if (!isAuthenticatedUser(user)) {
			throw new UnauthorizedException({
				message: "Authentication required",
				error: "UNAUTHENTICATED",
			});
		}

		// ── 3. Token version validation ────────────────────────────────────
		await this.validateTokenVersion(user.id, user.tokenVersion);

		// ── 4. Super-admin bypass ──────────────────────────────────────────
		if (user.isSuperAdmin) {
			await this.auditSuperAdminBypass(user.id, context);
			Object.assign<AuthenticatedUser, { hasAdminAccess: boolean }>(user, { hasAdminAccess: true });
			return true;
		}

		// ── 5. Kernel authorization checks ─────────────────────────────────

		// Single permission check
		if (legacyPermission) {
			await this.checkPermission(user.id, legacyPermission.action, legacyPermission.resource);
		}

		// Multi-permission checks (AND/OR)
		if (permissionsMeta) {
			await this.checkPermissions(user.id, permissionsMeta);
		}

		// Role checks (AND/OR)
		if (rolesMeta) {
			await this.checkRoles(user.id, rolesMeta);
		}

		// ── 6. Compute admin access ────────────────────────────────────────
		const hasAdminAccess = await this.hasAdminDashboardAccess(user.id);
		Object.assign<AuthenticatedUser, { hasAdminAccess: boolean }>(user, { hasAdminAccess });

		return true;
	}

	// ── Private: Metadata Extraction ────────────────────────────────────────

	private getLegacyPermission(context: ExecutionContext): RequiredPermission | undefined {
		return this.reflector.getAllAndOverride<RequiredPermission>(REQUIRED_PERMISSION_KEY, [context.getHandler(), context.getClass()]);
	}

	private getPermissionsMeta(context: ExecutionContext): RequiredPermissionsMetadata | undefined {
		return this.reflector.getAllAndOverride<RequiredPermissionsMetadata>(REQUIRED_PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
	}

	private getRolesMeta(context: ExecutionContext): RequiredRolesMetadata | undefined {
		return this.reflector.getAllAndOverride<RequiredRolesMetadata>(REQUIRED_ROLES_KEY, [context.getHandler(), context.getClass()]);
	}

	// ── Private: Authorization Checks ────────────────────────────────────────

	/**
	 * Check a single permission via kernel.
	 */
	private async checkPermission(userId: string, action: string, resource: string): Promise<void> {
		const decision: AuthorizationDecision = await this.kernel.can({
			userId,
			action: action as never,
			resource: resource as never,
		});

		if (decision === "DENY") {
			throw new ForbiddenException({
				message: "Insufficient permissions",
				error: "PERMISSION_DENIED",
			});
		}
	}

	/**
	 * Check multiple permissions with AND/OR semantics via kernel.
	 */
	private async checkPermissions(userId: string, meta: RequiredPermissionsMetadata): Promise<void> {
		const requirements = meta.permissions.map((p) => ({
			action: p[0],
			resource: p[1],
		}));

		const results = await Promise.all(
			requirements.map((req) =>
				this.kernel.can({
					userId,
					action: req.action as never,
					resource: req.resource as never,
				}),
			),
		);

		const granted = meta.mode === "all" ? results.every((d) => d === "ALLOW") : results.some((d) => d === "ALLOW");

		if (!granted) {
			throw new ForbiddenException({
				message: meta.mode === "all" ? "Missing required permissions" : "Missing any of the required permissions",
				error: "PERMISSION_DENIED",
			});
		}
	}

	/**
	 * Check roles via kernel.
	 * Note: Role checks currently use legacy checker until kernel supports role-based checks natively.
	 * TODO: Implement role checks in kernel for consistency.
	 */
	private async checkRoles(userId: string, meta: RequiredRolesMetadata): Promise<void> {
		// For now, delegate to kernel's can() using role-based permissions
		// In the future, kernel should have native role check support
		const checks = meta.roles.map((role) =>
			this.kernel.can({
				userId,
				action: "ASSUME" as never,
				resource: role as never,
			}),
		);

		const results = await Promise.all(checks);
		const granted = meta.mode === "all" ? results.every((d) => d === "ALLOW") : results.some((d) => d === "ALLOW");

		if (!granted) {
			throw new ForbiddenException({
				message: meta.mode === "all" ? "Missing required roles" : "Missing any of the required roles",
				error: "ROLE_DENIED",
			});
		}
	}

	// ── Private: Token & Admin Access ───────────────────────────────────────

	/**
	 * Validate token version against database.
	 * Rejects stale tokens to force re-authentication.
	 */
	private async validateTokenVersion(userId: string, tokenVersion: number): Promise<void> {
		const dbUser = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { tokenVersion: true },
		});

		if (dbUser !== null && dbUser.tokenVersion !== tokenVersion) {
			throw new UnauthorizedException({
				message: "Token revoked — authorization state changed",
				error: "TOKEN_VERSION_MISMATCH",
			});
		}
	}

	/**
	 * Check if user has admin dashboard access.
	 */
	private async hasAdminDashboardAccess(userId: string): Promise<boolean> {
		const decision = await this.kernel.can({
			userId,
			action: "READ" as never,
			resource: "ADMIN_DASHBOARD" as never,
		});

		return decision === "ALLOW";
	}

	/**
	 * Audit super-admin authorization bypass.
	 */
	private async auditSuperAdminBypass(userId: string, context: ExecutionContext): Promise<void> {
		const request = context.switchToHttp().getRequest<FastifyRequest>();
		const handlerName = context.getHandler().name;

		await this.audit.log({
			action: "SUPER_ADMIN_BYPASS",
			actorId: userId,
			detail: `Bypassed authorization for ${handlerName} at ${request.url}`,
		});
	}

	/**
	 * Ensure hasAdminAccess is computed for public routes
	 * (needed by downstream guards and RLS interceptor).
	 */
	private async ensureAdminAccess(context: ExecutionContext): Promise<void> {
		const request = context.switchToHttp().getRequest<FastifyRequest>();

		if (!isAuthenticatedUser(request.user)) {
			return;
		}

		const user = request.user;

		if (user.isSuperAdmin) {
			Object.assign<AuthenticatedUser, { hasAdminAccess: boolean }>(user, { hasAdminAccess: true });
			return;
		}

		const hasAdminAccess = await this.hasAdminDashboardAccess(user.id);
		Object.assign<AuthenticatedUser, { hasAdminAccess: boolean }>(user, { hasAdminAccess });
	}
}
