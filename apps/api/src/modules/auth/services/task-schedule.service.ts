import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { LogService } from "../../../modules/logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { MfaRecoveryService } from "./mfa-recovery.service";
import { runWithSystemRlsContext } from "../../../prisma/rls-context";

/** Used reset tokens are retired 7 days after use. */
const USED_RESET_TOKEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** Expired reset tokens are retired 1 hour after expiry (buffer for in-flight requests). */
const EXPIRED_RESET_TOKEN_GRACE_MS = 60 * 60 * 1000;

/**
 * Scheduled tasks for auth module housekeeping.
 *
 * - Retires (soft-deletes) used and expired password reset tokens every hour
 */
@Injectable()
export class TaskScheduleService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly logService: LogService,
		private readonly mfaRecoveryService: MfaRecoveryService,
	) {}

	/**
	 * Runs every hour. Soft-deletes password reset tokens that:
	 *  - Have been used (usedAt is set) AND are older than 7 days (cleanup old records)
	 *  - Have expired (expiresAt < now) AND are at least 1 hour old (give buffer for in-flight requests)
	 */
	@Cron(CronExpression.EVERY_HOUR)
	public async cleanupExpiredResetTokens(): Promise<void> {
		await runWithSystemRlsContext("maintenance.password_reset_token_cleanup", async (): Promise<void> => this.runCleanupExpiredResetTokens());
	}

	private async runCleanupExpiredResetTokens(): Promise<void> {
		const nowMs: number = Date.now();

		// Soft-delete (never DELETE): a retired token keeps its row for the audit trail,
		// and every reader already filters `isDeleted: false`.
		const result = await this.prisma.passwordResetToken.updateMany({
			where: {
				isDeleted: false,
				OR: [
					// Used tokens older than 7 days
					{ usedAt: { not: null, lte: nowMs - USED_RESET_TOKEN_RETENTION_MS } },
					// Expired tokens at least 1 hour past expiry (safety buffer for in-flight requests)
					{ expiresAt: { lte: nowMs - EXPIRED_RESET_TOKEN_GRACE_MS } },
				],
			},
			data: { isDeleted: true, deletedAt: nowMs, updatedAt: nowMs },
		});

		if (result.count > 0) {
			this.logService.info("Cleaned up expired password reset tokens", {
				context: "TaskScheduleService",
				metadata: { retired: result.count },
			});
		}
	}

	/** Processes approved MFA recovery requests whose security delay has elapsed. */
	@Cron(CronExpression.EVERY_10_MINUTES)
	public async processMfaRecoveryUnlocks(): Promise<void> {
		await runWithSystemRlsContext("maintenance.mfa_recovery_unlock", async (): Promise<void> => this.runProcessMfaRecoveryUnlocks());
	}

	private async runProcessMfaRecoveryUnlocks(): Promise<void> {
		await this.mfaRecoveryService.processScheduledUnlocks();
	}
}
