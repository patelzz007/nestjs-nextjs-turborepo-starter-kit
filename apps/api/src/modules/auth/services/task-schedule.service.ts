import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { LogService } from "../../../modules/logs/logs.service.js";
import { PrismaService } from "../../../prisma/prisma.service.js";

/**
 * Scheduled tasks for auth module housekeeping.
 *
 * - Cleans up expired password reset tokens every hour
 */
@Injectable()
export class TaskScheduleService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly logService: LogService,
	) {}

	/**
	 * Runs every hour. Deletes password reset tokens that:
	 *  - Have been used (usedAt is set) AND are older than 7 days (cleanup old records)
	 *  - Have expired (expiresAt < now) AND are at least 1 hour old (give buffer for in-flight requests)
	 */
	@Cron(CronExpression.EVERY_HOUR)
	public async cleanupExpiredResetTokens(): Promise<void> {
		const now = new Date();

		const result = await this.prisma.passwordResetToken.deleteMany({
			where: {
				OR: [
					// Used tokens older than 7 days — clean up old records
					{ usedAt: { not: null, lte: new Date(now.getTime() - 7 * 86_400_000) } },
					// Expired tokens that are at least 1 hour past expiry (safety buffer)
					{ expiresAt: { lte: new Date(now.getTime() - 3_600_000) } },
				],
			},
		});

		if (result.count > 0) {
			this.logService.info("Cleaned up expired password reset tokens", {
				context: "TaskScheduleService",
				metadata: { deleted: result.count },
			});
		}
	}
}
