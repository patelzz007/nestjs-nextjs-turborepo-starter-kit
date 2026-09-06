import { Injectable, Logger } from "@nestjs/common";
import { nowEpochMs } from "@workspace/shared";

import { PrismaService } from "../../../prisma/prisma.service";

/**
 * Revokes every active session for affected users when authorization state changes.
 *
 * Bumps `tokenVersion` and soft-deletes refresh tokens so clients cannot silently
 * refresh into a new access token after roles or permissions change.
 */
@Injectable()
export class UserSessionRevocationService {
	private readonly logger: Logger = new Logger(UserSessionRevocationService.name);

	public constructor(private readonly prisma: PrismaService) {}

	public async revokeAllSessionsForUser(userId: string): Promise<void> {
		await this.revokeAllSessionsForUsers([userId]);
	}

	public async revokeAllSessionsForUsers(userIds: readonly string[]): Promise<void> {
		if (userIds.length === 0) {
			return;
		}

		const uniqueUserIds: string[] = [...new Set(userIds)];
		const now: number = nowEpochMs();

		await this.prisma.$transaction(async (tx) => {
			await tx.refreshToken.updateMany({
				where: { userId: { in: uniqueUserIds }, isDeleted: false },
				data: { isDeleted: true, deletedAt: now, updatedAt: now },
			});

			await tx.user.updateMany({
				where: { id: { in: uniqueUserIds } },
				data: { tokenVersion: { increment: 1 }, updatedAt: now },
			});
		});

		this.logger.log(`Revoked all sessions for ${String(uniqueUserIds.length)} user(s) after authorization change`);
	}
}
