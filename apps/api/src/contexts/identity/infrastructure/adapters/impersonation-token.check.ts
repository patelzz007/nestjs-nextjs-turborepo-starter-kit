import { Injectable, UnauthorizedException } from "@nestjs/common";
import { nowEpochMs, type AccessTokenPayload } from "@workspace/shared";

import { PrismaService } from "../../../../prisma/prisma.service";
import type { ImpersonationTokenCheckPort } from "../../../../platform/application/ports/access-token.port";

function invalidImpersonationSession(): UnauthorizedException {
	return new UnauthorizedException({ message: "Impersonation session has ended or is no longer valid", error: "IMPERSONATION_SESSION_INVALID" });
}

/**
 * Server-side revocation check for impersonation access tokens. A signed impersonation JWT alone is
 * not enough: its `impersonationSessionId` must name a live session for the same impersonator and
 * target, and the impersonator must still be an active SuperAdmin. Runs inside the guard's
 * `request.pre_handler` bypass scope (sessions are bypass-only under RLS).
 */
@Injectable()
export class ImpersonationTokenCheck implements ImpersonationTokenCheckPort {
	public constructor(private readonly prisma: PrismaService) {}

	public async assertLiveIfImpersonating(payload: AccessTokenPayload): Promise<void> {
		if (payload.isImpersonating !== true) {
			return;
		}
		if (payload.originalUserId === undefined || payload.impersonationSessionId === undefined) {
			throw invalidImpersonationSession();
		}
		const session = await this.prisma.impersonationSession.findFirst({
			where: {
				id: payload.impersonationSessionId,
				impersonatorId: payload.originalUserId,
				targetUserId: payload.sub,
				endedAt: null,
				expiresAt: { gt: nowEpochMs() },
				impersonator: { isSuperAdmin: true, isActive: true, isDeleted: false },
			},
			select: { id: true },
		});
		if (session === null) {
			throw invalidImpersonationSession();
		}
	}
}
