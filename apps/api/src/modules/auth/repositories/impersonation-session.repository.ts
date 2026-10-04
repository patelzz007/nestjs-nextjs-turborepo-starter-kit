import { Injectable } from "@nestjs/common";
import { ImpersonationSessionEndReason, type Prisma } from "@prisma/client";

import { PrismaService } from "../../../prisma/prisma.service";

/** `ImpersonationAuditLog.action` values. */
export const ImpersonationAuditAction = {
	START: "START",
	STOP: "STOP",
} satisfies Record<string, string>;

/** Request metadata recorded on the session and on each audit row. */
export interface ImpersonationClientInfo {
	readonly ipAddress: string | null;
	readonly userAgent: string | null;
}

export interface StartImpersonationSessionInput extends ImpersonationClientInfo {
	readonly impersonatorId: string;
	readonly targetUserId: string;
	readonly startedAt: number;
	readonly expiresAt: number;
}

export interface EndImpersonationSessionInput extends ImpersonationClientInfo {
	readonly sessionId: string;
	readonly impersonatorId: string;
	readonly targetUserId: string;
	readonly endedAt: number;
}

/** The claims of an impersonation access token that identify its server-side session. */
export interface ImpersonationSessionClaims {
	readonly sessionId: string;
	readonly impersonatorId: string;
	readonly targetUserId: string;
}

/**
 * Persistence for server-side impersonation sessions and their immutable
 * START/STOP audit rows (`impersonation_sessions`, `impersonation_audit_logs`).
 * Both tables are bypass-only under RLS; every caller runs in a bypass scope
 * (`platform.superadmin`, `route.rls_bypass`, or `request.pre_handler`).
 */
@Injectable()
export class ImpersonationSessionRepository {
	public constructor(private readonly prisma: PrismaService) {}

	/**
	 * Create the session and its START audit row, then run `withinTransaction`
	 * (token signing + the caller's outbox event) — all in one transaction, so a
	 * failure anywhere leaves neither a session nor an audit row behind.
	 */
	public async start<TResult>(
		input: StartImpersonationSessionInput,
		withinTransaction: (tx: Prisma.TransactionClient, sessionId: string) => Promise<TResult>,
	): Promise<TResult> {
		return this.prisma.$transaction(async (tx): Promise<TResult> => {
			const session = await tx.impersonationSession.create({
				data: {
					impersonatorId: input.impersonatorId,
					targetUserId: input.targetUserId,
					startedAt: input.startedAt,
					expiresAt: input.expiresAt,
					ipAddress: input.ipAddress,
					userAgent: input.userAgent,
				},
				select: { id: true },
			});
			await tx.impersonationAuditLog.create({
				data: {
					impersonatorId: input.impersonatorId,
					targetUserId: input.targetUserId,
					sessionId: session.id,
					action: ImpersonationAuditAction.START,
					ipAddress: input.ipAddress,
					userAgent: input.userAgent,
				},
			});
			return withinTransaction(tx, session.id);
		});
	}

	/**
	 * End a live session with a compare-and-set on `endedAt IS NULL`, record the
	 * STOP audit row (the impersonator is the actor), and run `withinTransaction`
	 * — all atomically. Returns `false`, writing nothing, when the session is
	 * unknown, belongs to another impersonator/target, or already ended.
	 */
	public async end(input: EndImpersonationSessionInput, withinTransaction: (tx: Prisma.TransactionClient) => Promise<void>): Promise<boolean> {
		return this.prisma.$transaction(async (tx): Promise<boolean> => {
			const ended = await tx.impersonationSession.updateMany({
				where: { id: input.sessionId, impersonatorId: input.impersonatorId, targetUserId: input.targetUserId, endedAt: null },
				data: { endedAt: input.endedAt, endedBy: input.impersonatorId, endReason: ImpersonationSessionEndReason.STOPPED, updatedAt: input.endedAt },
			});
			if (ended.count !== 1) {
				return false;
			}
			await tx.impersonationAuditLog.create({
				data: {
					impersonatorId: input.impersonatorId,
					targetUserId: input.targetUserId,
					sessionId: input.sessionId,
					action: ImpersonationAuditAction.STOP,
					ipAddress: input.ipAddress,
					userAgent: input.userAgent,
				},
			});
			await withinTransaction(tx);
			return true;
		});
	}

	/**
	 * Whether the session behind an impersonation token is live at `now`: it
	 * exists for exactly this impersonator + target, has not ended, has not
	 * expired, and the impersonator is still an active, non-deleted SuperAdmin.
	 */
	public async isLive(claims: ImpersonationSessionClaims, now: number): Promise<boolean> {
		const session = await this.prisma.impersonationSession.findFirst({
			where: {
				id: claims.sessionId,
				impersonatorId: claims.impersonatorId,
				targetUserId: claims.targetUserId,
				endedAt: null,
				expiresAt: { gt: now },
				impersonator: { isSuperAdmin: true, isActive: true, isDeleted: false },
			},
			select: { id: true },
		});
		return session !== null;
	}
}
