import { CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";

/**
 * Guard that checks whether the authenticated user is a SuperAdmin.
 *
 * This guard should be used AFTER AuthGuard (which attaches the user payload).
 * The `@SuperAdminOnly()` decorator combines both guards automatically.
 */
@Injectable()
export class SuperAdminGuard implements CanActivate {
	public canActivate(context: ExecutionContext): boolean {
		const request: Request = context.switchToHttp().getRequest<Request>();
		const user: Record<string, unknown> | undefined = request.user as Record<string, unknown> | undefined;

		if (!user || user.isSuperAdmin !== true) {
			throw new ForbiddenException({
				message: "Super admin privileges required",
				error: "SUPER_ADMIN_REQUIRED",
			});
		}

		return true;
	}
}
