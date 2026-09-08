import { Injectable, Logger } from "@nestjs/common";

import { AccessTokenStateService } from "../../auth/services/access-token-state.service";
import { RefreshTokenRepository } from "../../sessions/repositories/refresh-token.repository";
import { SessionUserRepository } from "../../sessions/repositories/session-user.repository";

/**
 * Revokes every active session for affected users when authorization state changes.
 */
@Injectable()
export class UserSessionRevocationService {
	private readonly logger: Logger = new Logger(UserSessionRevocationService.name);

	public constructor(
		private readonly refreshTokens: RefreshTokenRepository,
		private readonly sessionUsers: SessionUserRepository,
		private readonly accessTokenState: AccessTokenStateService,
	) {}

	public async revokeAllSessionsForUser(userId: string): Promise<void> {
		await this.revokeAllSessionsForUsers([userId]);
	}

	public async revokeAllSessionsForUsers(userIds: readonly string[]): Promise<void> {
		if (userIds.length === 0) {
			return;
		}

		const uniqueUserIds: string[] = [...new Set(userIds)];

		await this.refreshTokens.revokeAllForUsers(uniqueUserIds);
		await this.sessionUsers.bumpTokenVersions(uniqueUserIds);

		for (const userId of uniqueUserIds) {
			this.accessTokenState.invalidate(userId);
		}

		this.logger.log(`Revoked all sessions for ${String(uniqueUserIds.length)} user(s) after authorization change`);
	}
}
