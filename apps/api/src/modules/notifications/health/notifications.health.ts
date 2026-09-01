import { Injectable, Logger } from "@nestjs/common";

import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Health check for the notifications system.
 *
 * Verifies that email logging and sending are operational.
 */
@Injectable()
export class NotificationsHealthIndicator {
	private readonly logger: Logger = new Logger(NotificationsHealthIndicator.name);

	public constructor(private readonly prisma: PrismaService) {}

	/**
	 * Check that the notifications system is operational.
	 *
	 * @returns `true` if the database is reachable and email tables exist.
	 */
	public async isHealthy(): Promise<boolean> {
		try {
			const email = await this.prisma.emailLog.findFirst({ select: { id: true } });
			return email !== null;
		} catch {
			this.logger.warn("Notifications health check failed");
			return false;
		}
	}

	/**
	 * Return a detailed health report.
	 */
	public async getReport(): Promise<{
		readonly healthy: boolean;
		readonly totalEmails: number;
		readonly failedEmails: number;
		readonly lastEmail: bigint | null;
	}> {
		try {
			const [totalEmails, failedEmails, lastEmail] = await Promise.all([
				this.prisma.emailLog.count(),
				this.prisma.emailLog.count({ where: { status: "failed" } }),
				this.prisma.emailLog.findFirst({
					orderBy: { createdAt: "desc" },
					select: { createdAt: true },
				}),
			]);

			return {
				healthy: true,
				totalEmails,
				failedEmails,
				lastEmail: lastEmail?.createdAt ?? null,
			};
		} catch {
			return { healthy: false, totalEmails: 0, failedEmails: 0, lastEmail: null };
		}
	}
}
