import { Injectable, Logger } from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";
import { AccessTokenStateService } from "../../auth/services/access-token-state.service";
import { RefreshTokenRepository } from "../../sessions/repositories/refresh-token.repository";
import { SessionUserRepository } from "../../sessions/repositories/session-user.repository";

/** A caller-supplied write that must commit atomically with the revocation (e.g. its outbox event). */
export type RevocationTransactionWrite = (tx: Prisma.TransactionClient) => Promise<void>;

const NO_ADDITIONAL_WRITE: RevocationTransactionWrite = (): Promise<void> => Promise.resolve();

/**
 * Revokes every active session for affected users when authorization state changes.
 */
@Injectable()
export class UserSessionRevocationService {
	private readonly logger: Logger = new Logger(UserSessionRevocationService.name);

	public constructor(
		private readonly prisma: PrismaService,
		private readonly refreshTokens: RefreshTokenRepository,
		private readonly sessionUsers: SessionUserRepository,
		private readonly accessTokenState: AccessTokenStateService,
	) {}

	public async revokeAllSessionsForUser(userId: string, withinTransaction: RevocationTransactionWrite = NO_ADDITIONAL_WRITE): Promise<void> {
		await this.revokeAllSessionsForUsers([userId], withinTransaction);
	}

	/**
	 * Refresh-token revocation, the tokenVersion bump, and `withinTransaction`
	 * commit together; the in-process access-token cache is invalidated only
	 * after commit, so a concurrent reload cannot re-cache the old tokenVersion.
	 */
	public async revokeAllSessionsForUsers(userIds: readonly string[], withinTransaction: RevocationTransactionWrite = NO_ADDITIONAL_WRITE): Promise<void> {
		if (userIds.length === 0) {
			return;
		}

		const uniqueUserIds: string[] = [...new Set(userIds)];

		await this.prisma.$transaction(async (tx): Promise<void> => {
			await this.refreshTokens.revokeAllForUsers(uniqueUserIds, tx);
			await this.sessionUsers.bumpTokenVersions(uniqueUserIds, tx);
			await withinTransaction(tx);
		});

		for (const userId of uniqueUserIds) {
			this.accessTokenState.invalidate(userId);
		}

		this.logger.log(`Revoked all sessions for ${String(uniqueUserIds.length)} user(s) after authorization change`);
	}
}
