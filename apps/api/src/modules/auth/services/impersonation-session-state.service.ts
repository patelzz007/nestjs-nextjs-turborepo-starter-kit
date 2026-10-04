import { Injectable, UnauthorizedException } from "@nestjs/common";
import { nowEpochMs, type AccessTokenPayload } from "@workspace/shared";

import { ImpersonationSessionRepository } from "../repositories/impersonation-session.repository";

/**
 * Server-side revocation check for impersonation access tokens.
 *
 * A signed impersonation JWT alone is not enough: its `impersonationSessionId`
 * must name a live `ImpersonationSession` for the same impersonator + target,
 * and the impersonator must still be an active SuperAdmin. Stopping
 * impersonation (or deactivating the admin) therefore revokes the token
 * immediately instead of at JWT expiry. Non-impersonation tokens pass through.
 */
@Injectable()
export class ImpersonationSessionStateService {
	public constructor(private readonly sessions: ImpersonationSessionRepository) {}

	public async assertLiveIfImpersonating(payload: AccessTokenPayload): Promise<void> {
		if (payload.isImpersonating !== true) {
			return;
		}

		if (payload.originalUserId === undefined || payload.impersonationSessionId === undefined) {
			throw invalidImpersonationSession();
		}

		const isLive: boolean = await this.sessions.isLive(
			{ sessionId: payload.impersonationSessionId, impersonatorId: payload.originalUserId, targetUserId: payload.sub },
			nowEpochMs(),
		);
		if (!isLive) {
			throw invalidImpersonationSession();
		}
	}
}

function invalidImpersonationSession(): UnauthorizedException {
	return new UnauthorizedException({
		message: "Impersonation session has ended or is no longer valid",
		error: "IMPERSONATION_SESSION_INVALID",
	});
}
