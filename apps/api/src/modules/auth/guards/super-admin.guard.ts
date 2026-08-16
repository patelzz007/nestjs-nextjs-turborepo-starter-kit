import { CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

/**
 * Guard that checks whether the authenticated user can access
 * admin-protected routes.
 *
 * Access is granted if:
 * 1. The user has `isSuperAdmin === true`, OR
 * 2. The user has the `ADMIN_DASHBOARD` resource permission (pre-computed
 *    as `hasAdminAccess` in the JWT payload at login time).
 *
 * This guard should be used AFTER AuthGuard (which attaches the JWT payload).
 * The `@SuperAdminOnly()` decorator combines both guards automatically.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
	public canActivate(context: ExecutionContext): boolean {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const user = request.user;

		if (!user) {
			throw new ForbiddenException({
				message: "Super admin privileges required",
				error: "SUPER_ADMIN_REQUIRED",
			});
		}

		// Fast path: isSuperAdmin bypasses permission check
		if ("isSuperAdmin" in user && user.isSuperAdmin) {
			return true;
		}

		// Use the pre-computed hasAdminAccess flag from the JWT payload
		// (computed once at login time by AuthService.buildUserResponse)
		if (!("hasAdminAccess" in user) || !user.hasAdminAccess) {
			throw new ForbiddenException({
				message: "Super admin privileges required",
				error: "SUPER_ADMIN_REQUIRED",
			});
		}

		return true;
	}
}
