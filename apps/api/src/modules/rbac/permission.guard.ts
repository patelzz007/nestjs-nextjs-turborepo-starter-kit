import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";
import type { PermissionAction, PermissionResource } from "@workspace/shared";

import { REQUIRED_PERMISSION_KEY, type RequiredPermission } from "./permission.constants";

/**
 * Checks JWT `permissions` for the action+resource set by `@RequirePermission`.
 * `MANAGE` on the same resource grants every action. `isSuperAdmin` bypasses.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
	public constructor(private readonly reflector: Reflector) {}

	public canActivate(context: ExecutionContext): boolean {
		const required: RequiredPermission | undefined = this.reflector.getAllAndOverride<RequiredPermission>(REQUIRED_PERMISSION_KEY, [
			context.getHandler(),
			context.getClass(),
		]);
		if (required === undefined) {
			return true;
		}

		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const user = request.user;

		if (user === undefined) {
			throw new ForbiddenException({
				message: "User not authenticated",
				error: "UNAUTHENTICATED",
			});
		}

		if ("isSuperAdmin" in user && user.isSuperAdmin) {
			return true;
		}

		if (!("permissions" in user)) {
			throw new ForbiddenException({
				message: "Missing permission",
				error: "PERMISSION_DENIED",
			});
		}

		const granted: boolean = user.permissions.some((permission): boolean => grantsPermission(permission.action, permission.resource, required.action, required.resource));
		if (!granted) {
			throw new ForbiddenException({
				message: `Missing permission ${required.action} ${required.resource}`,
				error: "PERMISSION_DENIED",
			});
		}

		return true;
	}
}

function grantsPermission(action: string, resource: string, requiredAction: PermissionAction, requiredResource: PermissionResource): boolean {
	if (resource !== requiredResource) {
		return false;
	}
	return action === requiredAction || action === "MANAGE";
}
