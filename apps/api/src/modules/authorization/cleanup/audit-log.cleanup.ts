import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { nowEpochMs } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";

/** Retention period for authorization audit logs (90 days in milliseconds). */
const RETENTION_MS: number = 90 * 24 * 60 * 60 * 1000;

/**
 * Background job that soft-deletes authorization audit logs older than 90 days.
 *
 * Prevents unbounded DB growth while preserving a meaningful audit trail.
 * Runs hourly; the workload is minimal (single UPDATE with a WHERE clause).
 */
@Injectable()
export class AuditLogCleanup {
	private readonly logger: Logger = new Logger(AuditLogCleanup.name);

	public constructor(private readonly prisma: PrismaService) {}

	/**
	 * Soft-delete authorization audit logs older than the retention period.
	 *
	 * Runs hourly via `@nestjs/schedule`. The `@@index([createdAt])` on
	 * `PermissionAuditLog` ensures the UPDATE is efficient even with millions
	 * of rows.
	 */
	@Cron(CronExpression.EVERY_HOUR)
	public async handleCleanup(): Promise<void> {
		const cutoff = BigInt(nowEpochMs() - RETENTION_MS);

		const { count } = await this.prisma.permissionAuditLog.updateMany({
			where: {
				isDeleted: false,
				createdAt: { lt: cutoff },
			},
			data: {
				isDeleted: true,
				deletedAt: nowEpochMs(),
			},
		});

		if (count > 0) {
			this.logger.log(`Soft-deleted ${String(count)} authorization audit logs older than 90 days`);
		}
	}
}
