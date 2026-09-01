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
import { AuthRateLimitService } from "../services/auth-rate-limit.service";
import { AuthorizationCheckerService } from "../services/authorization-checker.service";

/**
 * Unified authorization guard that handles:
 *
 * 1. **Legacy `@RequirePermission(action, resource)`** — single permission check.
 * 2. **`@RequireAllPermissions(...)`** — AND semantics across multiple permissions.
 * 3. **`@RequireAnyPermission(...)`** — OR semantics across multiple permissions.
 * 4. **`@RequireAllRoles(...)`** — AND semantics across multiple roles.
 * 5. **`@RequireAnyRole(...)`** — OR semantics across multiple roles.
 *
 * Registered as a **global guard** after `AuthGuard` so `request.user`
 * is already populated with the JWT identity.
 *
 * ## Super-admin bypass
 *
 * Users with `isSuperAdmin: true` always pass this guard regardless of
 * their assigned permissions or roles.
 *
 * ## Wildcard: `MANAGE` action
 *
 * A `MANAGE` permission on a resource satisfies any action on that
 * resource (handled inside `AuthorizationCheckerService`).
 */
@Injectable()
export class AuthorizationGuard implements CanActivate {
	private readonly logger: Logger = new Logger(AuthorizationGuard.name);

	public constructor(
		private readonly reflector: Reflector,
		private readonly checker: AuthorizationCheckerService,
		private readonly audit: AuthorizationAuditService,
		private readonly rateLimit: AuthRateLimitService,
		private readonly prisma: PrismaService,
	) {}

	public async canActivate(context: ExecutionContext): Promise<boolean> {
		// ── 1. Read all metadata from handler + class ──────────────────────
		const legacyPermission: RequiredPermission | undefined = this.reflector.getAllAndOverride<RequiredPermission>(REQUIRED_PERMISSION_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		const permissionsMeta: RequiredPermissionsMetadata | undefined = this.reflector.getAllAndOverride<RequiredPermissionsMetadata>(REQUIRED_PERMISSIONS_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		const rolesMeta: RequiredRolesMetadata | undefined = this.reflector.getAllAndOverride<RequiredRolesMetadata>(REQUIRED_ROLES_KEY, [
			context.getHandler(),
			context.getClass(),
		]);

		// No authorization metadata → allow (public route or unguarded).
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- getAllAndOverride returns T | undefined; metadata may not be set on every handler.
		if (legacyPermission === undefined && permissionsMeta === undefined && rolesMeta === undefined) {
			// Still compute hasAdminAccess when no metadata is present, because
			// downstream guards (AdminAccessGuard, SuperAdminGuard) and the
			// RlsInterceptor rely on it being on request.user.
			await this.ensureAdminAccess(context);
			return true;
		}

		// ── 2. Extract the authenticated user from the request ─────────────
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const user = request.user;

		if (!isAuthenticatedUser(user)) {
			throw new UnauthorizedException({
				message: "Authentication required",
				error: "UNAUTHENTICATED",
			});
		}

		const userId: string = user.id;

		// ── 2b. Token version check ────────────────────────────────────────
		// The JWT carries a `tokenVersion` that is incremented on every
		// role/permission mutation. If the token is stale, reject immediately
		// so the user must re-login (or refresh) to get a fresh token.
		const dbUser = await this.prisma.user.findUnique({
			where: { id: userId },
			select: { tokenVersion: true },
		});
		if (dbUser !== null && dbUser.tokenVersion !== user.tokenVersion) {
			throw new UnauthorizedException({
				message: "Token revoked — authorization state changed",
				error: "TOKEN_VERSION_MISMATCH",
			});
		}

		// ── 3. Super-admin bypass ──────────────────────────────────────────
		if (user.isSuperAdmin) {
			// Audit trail for super-admin bypass
			const requestUrl: string = context.switchToHttp().getRequest<FastifyRequest>().url;
			await this.audit.log({
				action: "SUPER_ADMIN_BYPASS",
				actorId: userId,
				detail: `Bypassed authorization for ${context.getHandler().name} at ${requestUrl}`,
			});
			// Super-admins always have admin access — set it eagerly so
			// downstream guards don't need to re-resolve.
			Object.assign<AuthenticatedUser, { hasAdminAccess: boolean }>(user, { hasAdminAccess: true });
			return true;
		}

		// ── 3b. Compute hasAdminAccess at runtime ─────────────────────────
		// Always resolve from DB/cache rather than trusting the JWT value,
		// which may be stale if permissions changed after token issuance.
		const hasAdminDashboard: boolean = await this.checker.hasPermission(userId, "READ", "ADMIN_DASHBOARD");
		Object.assign<AuthenticatedUser, { hasAdminAccess: boolean }>(user, { hasAdminAccess: hasAdminDashboard });

		// ── 4. Evaluate permission requirements ────────────────────────────

		// Legacy single-permission decorator
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- getAllAndOverride returns T | undefined; metadata may not be set on every handler.
		if (legacyPermission !== undefined) {
			const granted: boolean = await this.checker.hasPermission(userId, legacyPermission.action, legacyPermission.resource);
			if (!granted) {
				throw new ForbiddenException({
					message: "Insufficient permissions",
					error: "PERMISSION_DENIED",
				});
			}
		}

		// Multi-permission decorator
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- getAllAndOverride returns T | undefined; metadata may not be set on every handler.
		if (permissionsMeta !== undefined) {
			const requirements = permissionsMeta.permissions.map((p) => ({ action: p[0], resource: p[1] }));

			if (permissionsMeta.mode === "all") {
				const granted: boolean = await this.checker.hasAllPermissions(userId, requirements);
				if (!granted) {
					throw new ForbiddenException({
						message: "Missing required permissions",
						error: "PERMISSION_DENIED",
					});
				}
			} else {
				const granted: boolean = await this.checker.hasAnyPermission(userId, requirements);
				if (!granted) {
					throw new ForbiddenException({
						message: "Missing any of the required permissions",
						error: "PERMISSION_DENIED",
					});
				}
			}
		}

		// ── 5. Evaluate role requirements ──────────────────────────────────

		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- getAllAndOverride returns T | undefined; metadata may not be set on every handler.
		if (rolesMeta !== undefined) {
			if (rolesMeta.mode === "all") {
				const granted: boolean = await this.checker.hasAllRoles(userId, rolesMeta.roles);
				if (!granted) {
					throw new ForbiddenException({
						message: "Missing required roles",
						error: "ROLE_DENIED",
					});
				}
			} else {
				const granted: boolean = await this.checker.hasAnyRole(userId, rolesMeta.roles);
				if (!granted) {
					throw new ForbiddenException({
						message: "Missing any of the required roles",
						error: "ROLE_DENIED",
					});
				}
			}
		}

		return true;
	}

	/**
	 * Ensure `hasAdminAccess` is present on `request.user` so downstream
	 * guards and interceptors can read it without re-resolving.
	 *
	 * Called when no authorization metadata is present on the route (i.e.
	 * routes that don't use `@RequirePermission` but still need admin
	 * access for RLS bypass or downstream admin guards).
	 */
	private async ensureAdminAccess(context: ExecutionContext): Promise<void> {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();

		if (!isAuthenticatedUser(request.user)) {
			return;
		}

		const user: AuthenticatedUser = request.user;

		if (user.isSuperAdmin) {
			Object.assign<AuthenticatedUser, { hasAdminAccess: boolean }>(user, { hasAdminAccess: true });
			return;
		}

		const hasAdminDashboard: boolean = await this.checker.hasPermission(user.id, "READ", "ADMIN_DASHBOARD");
		Object.assign<AuthenticatedUser, { hasAdminAccess: boolean }>(user, { hasAdminAccess: hasAdminDashboard });
	}
}
