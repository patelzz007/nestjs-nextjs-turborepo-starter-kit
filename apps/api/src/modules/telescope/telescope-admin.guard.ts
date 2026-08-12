import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { Request } from "express";

import type { AccessTokenPayload } from "../auth/services/token.service";

/**
 * Defense-in-depth admin gate for `/telescope/*` (docs/telescope.md §10.7).
 * The global `AuthGuard` already proves the caller is authenticated; this
 * guard additionally requires `hasAdminAccess` — Telescope exposes request
 * bodies, SQL and user ids, so it must never be reachable by a plain user.
 */
@Injectable()
export class TelescopeAdminGuard implements CanActivate {
	public canActivate(context: ExecutionContext): boolean {
		const request: Request = context.switchToHttp().getRequest<Request>();
		// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- Runtime type: AuthGuard attaches the JWT payload
		const user: AccessTokenPayload | undefined = (request as { user?: AccessTokenPayload }).user;
		if (user?.hasAdminAccess !== true) {
			throw new ForbiddenException({ message: "Admin access required to view Telescope data.", error: "ADMIN_ACCESS_REQUIRED" });
		}
		return true;
	}
}
