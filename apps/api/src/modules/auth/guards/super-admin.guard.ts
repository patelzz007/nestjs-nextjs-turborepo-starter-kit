import { CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

import { isAuthenticatedUser } from "../../../types/authenticated-user";

/**
 * Guard that restricts access to users with `isSuperAdmin === true` only.
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

		if (isAuthenticatedUser(user) && user.isSuperAdmin === true) {
			return true;
		}

		throw new ForbiddenException({
			message: "Super admin privileges required",
			error: "SUPER_ADMIN_REQUIRED",
		});
	}
}
