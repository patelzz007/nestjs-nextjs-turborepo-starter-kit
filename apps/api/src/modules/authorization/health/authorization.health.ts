import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Health check for the authorization system.
 *
 * Verifies that the database has the expected RBAC tables and seed data
 * by querying for a known role.
 */
@Injectable()
export class AuthorizationHealthIndicator {
	private readonly logger: Logger = new Logger(AuthorizationHealthIndicator.name);

	public constructor(private readonly prisma: PrismaService) {}

	/**
	 * Check that the authorization system is operational.
	 *
	 * @returns `true` if the database is reachable and RBAC tables exist.
	 */
	public async isHealthy(): Promise<boolean> {
		try {
			const role = await this.prisma.role.findFirst({ where: { isDeleted: false }, select: { id: true } });
			return role !== null;
		} catch {
			this.logger.warn("Authorization health check failed");
			return false;
		}
	}

	/**
	 * Return a detailed health report.
	 */
	public async getReport(): Promise<{
		readonly healthy: boolean;
		readonly roleCount: number;
		readonly permissionCount: number;
		readonly userRoleCount: number;
		readonly rolePermissionCount: number;
	}> {
		try {
			const [roleCount, permissionCount, userRoleCount, rolePermissionCount] = await Promise.all([
				this.prisma.role.count({ where: { isDeleted: false } }),
				this.prisma.permission.count({ where: { isDeleted: false } }),
				this.prisma.userRole.count({ where: { isDeleted: false } }),
				this.prisma.rolePermission.count({ where: { isDeleted: false } }),
			]);

			return { healthy: true, roleCount, permissionCount, userRoleCount, rolePermissionCount };
		} catch {
			return { healthy: false, roleCount: 0, permissionCount: 0, userRoleCount: 0, rolePermissionCount: 0 };
		}
	}
}
