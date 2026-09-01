import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { nowEpochMs } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";
import { AuthorizationCacheService } from "../cache/authorization-cache.service";
import { AuthorizationEventEmitter } from "../events/authorization.events";

/**
 * Scheduled job that cleans up expired direct user permissions.
 *
 * Runs every hour. Finds all `UserPermission` rows where `expiresAt` is
 * in the past and soft-deletes them, then invalidates the affected users'
 * authorization caches.
 *
 * This ensures that time-bound permission grants (e.g., temporary access)
 * are enforced even if the user never makes another request.
 */
@Injectable()
export class PermissionExpiryCleanup {
	private readonly logger: Logger = new Logger(PermissionExpiryCleanup.name);

	public constructor(
		private readonly prisma: PrismaService,
		private readonly cache: AuthorizationCacheService,
		private readonly events: AuthorizationEventEmitter,
	) {}

	/**
	 * Soft-delete all expired direct user permissions and invalidate caches.
	 */
	@Cron(CronExpression.EVERY_HOUR)
	public async handleExpiryCleanup(): Promise<void> {
		const nowMs = nowEpochMs();

		const expired = await this.prisma.userPermission.findMany({
			where: {
				isDeleted: false,
				expiresAt: { not: null, lt: nowMs },
			},
			select: { id: true, userId: true, permissionId: true },
		});

		if (expired.length === 0) {
			return;
		}

		this.logger.log(`Cleaning up ${String(expired.length)} expired permission(s)`);

		// Batch soft-delete
		await this.prisma.userPermission.updateMany({
			where: {
				isDeleted: false,
				expiresAt: { not: null, lt: nowMs },
			},
			data: { isDeleted: true, deletedAt: nowMs },
		});

		// Invalidate caches for affected users (deduplicated)
		const affectedUserIds: string[] = [...new Set(expired.map((ep) => ep.userId))];
		this.cache.invalidateUsers(affectedUserIds);
		this.events.emitUsersMeInvalidate(affectedUserIds);

		this.logger.log(`Invalidated cache for ${String(affectedUserIds.length)} user(s) after expiry cleanup`);
	}
}
