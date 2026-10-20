import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { nowEpochMs, type AccessTokenPayload } from "@workspace/shared";
import type { Prisma } from "@prisma/client";

import type { ImpersonationTokenCheckPort } from "../../../../platform/application/ports/access-token.port";
import type { SystemDatabaseContext } from "../../../../prisma/tenant-context";
import { TenantTransactionService } from "../../../../prisma/tenant-transaction.service";
import { PRINCIPAL_LOOKUP_OPERATION } from "../../../../platform/application/shared-system-operations";

function invalidImpersonationSession(): UnauthorizedException {
	return new UnauthorizedException({ message: "Impersonation session has ended or is no longer valid", error: "IMPERSONATION_SESSION_INVALID" });
}

/** The guard's principal lookup, so the check does not depend on the request-wide bypass. */
interface PrincipalLookupTransactions {
	withSystemOperation<TResult>(context: SystemDatabaseContext, work: (tx: Prisma.TransactionClient) => Promise<TResult>): Promise<TResult>;
}

/**
 * Server-side revocation check for impersonation access tokens. A signed impersonation JWT alone is
 * not enough: its `impersonationSessionId` must name a live session for the same impersonator and
 * target, and the impersonator must still be an active SuperAdmin.
 */
@Injectable()
export class ImpersonationTokenCheck implements ImpersonationTokenCheckPort {
	public constructor(@Inject(TenantTransactionService) private readonly transactions: PrincipalLookupTransactions) {}

	public async assertLiveIfImpersonating(payload: AccessTokenPayload): Promise<void> {
		if (payload.isImpersonating !== true) {
			return;
		}
		if (payload.originalUserId === undefined || payload.impersonationSessionId === undefined) {
			throw invalidImpersonationSession();
		}
		const impersonatorId: string = payload.originalUserId;
		const sessionId: string = payload.impersonationSessionId;
		const session = await this.transactions.withSystemOperation(
			{ operation: PRINCIPAL_LOOKUP_OPERATION, reason: "Confirm an impersonation access token still names a live session", actorUserId: impersonatorId },
			(tx) =>
				tx.impersonationSession.findFirst({
					where: {
						id: sessionId,
						impersonatorId,
						targetUserId: payload.sub,
						endedAt: null,
						expiresAt: { gt: nowEpochMs() },
						impersonator: { isSuperAdmin: true, isActive: true, isDeleted: false },
					},
					select: { id: true },
				}),
		);
		if (session === null) {
			throw invalidImpersonationSession();
		}
	}
}
