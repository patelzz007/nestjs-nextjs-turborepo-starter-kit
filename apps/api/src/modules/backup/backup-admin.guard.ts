import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

/**
 * Admin gate for `/backup/*`.
 *
 * The global `AuthGuard` already proves the caller is authenticated; this
 * guard additionally requires `hasAdminAccess === true`. Backup files contain
 * the ENTIRE database (PII included) and the create/download/delete endpoints
 * can move or destroy data, so they must never be reachable by a plain user —
 * the admin panel proxy gating is defense-in-depth, not the boundary.
 */
@Injectable()
export class BackupAdminGuard implements CanActivate {
	public canActivate(context: ExecutionContext): boolean {
		const request: FastifyRequest = context.switchToHttp().getRequest<FastifyRequest>();
		const user = request.user;
		// Only access-token payloads carry `hasAdminAccess`; require it to be true.
		if (user === undefined || !("hasAdminAccess" in user) || !user.hasAdminAccess) {
			throw new ForbiddenException({ message: "Admin access required to manage database backups.", error: "ADMIN_ACCESS_REQUIRED" });
		}
		return true;
	}
}
