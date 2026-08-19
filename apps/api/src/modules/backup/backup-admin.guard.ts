import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { FastifyRequest } from "fastify";

/**
 * Admin gate for `/backup/*`.
 *
 * Layering: global `AuthGuard` → `BackupAdminGuard` (`hasAdminAccess`) →
 * global `PermissionGuard` (`@RequirePermission` on the `BACKUP` resource).
 * Backup files contain the ENTIRE database (PII included) — never reachable
 * by a plain user even if a proxy misroutes.
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
