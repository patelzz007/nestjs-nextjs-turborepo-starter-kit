import { CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { FastifyRequest } from "fastify";

import { ADMIN_ACCESS_MESSAGE_KEY, requireAdminAccessToken } from "../utils/admin-access";

/**
 * Shared admin gate — requires `hasAdminAccess` on the JWT access payload.
 * Pair with `@AdminAccessOnly(message)` for route-specific denial copy.
 */
@Injectable()
export class AdminAccessGuard implements CanActivate {
	public constructor(private readonly reflector: Reflector) {}

	public canActivate(context: ExecutionContext): boolean {
		const message: string =
			this.reflector.getAllAndOverride<string | undefined>(ADMIN_ACCESS_MESSAGE_KEY, [context.getHandler(), context.getClass()]) ?? "Admin access required.";

		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		requireAdminAccessToken(request.user, message);
		return true;
	}
}
