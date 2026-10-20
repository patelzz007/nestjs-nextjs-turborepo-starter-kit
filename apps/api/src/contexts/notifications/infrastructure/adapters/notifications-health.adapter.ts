import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";

/** Readiness probe for the email log. */
interface EmailLogHealthLookup {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/**
 * Health check for the notifications system.
 *
 * Verifies that email logging and sending are operational.
 */
@Injectable()
export class NotificationsHealthIndicator {
	private readonly logger: Logger = new Logger(NotificationsHealthIndicator.name);

	public constructor(@Inject(TenantTransactionService) private readonly transactions: EmailLogHealthLookup) {}

	/**
	 * Check that the notifications system is operational.
	 *
	 * @returns `true` if the database is reachable and email tables exist.
	 */
	public async isHealthy(): Promise<boolean> {
		try {
			const email = await this.transactions.withSystemOperation(
				{ operation: "notifications.health.email_log", reason: "Readiness: the email log is reachable", actorUserId: null },
				(tx) => tx.emailLog.findFirst({ select: { id: true } }),
			);
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
			const [totalEmails, failedEmails, lastEmail] = await this.transactions.withSystemOperation(
				{ operation: "notifications.health.email_log", reason: "Readiness: email log counts", actorUserId: null },
				(tx) =>
					Promise.all([
						tx.emailLog.count(),
						tx.emailLog.count({ where: { status: "failed" } }),
						tx.emailLog.findFirst({
							orderBy: { createdAt: "desc" },
							select: { createdAt: true },
						}),
					]),
			);

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
