import type { Prisma } from "@prisma/client";
import { epochMs, type EpochMs } from "@workspace/shared";

import { ImpersonationSession, type ImpersonationAuditEntry } from "../../domain/aggregates/impersonation-session.aggregate";
import { ImpersonationSessionInvalidError } from "../../domain/errors/identity.errors";
import type { ImpersonationSessionRepository } from "../../domain/repositories/impersonation-session.repository";
import { epochOrNull } from "./identity-row.mappers";

/**
 * Impersonation sessions and their immutable START/STOP audit rows (`ImpersonationSession`,
 * `ImpersonationAuditLog`, both bypass-only under RLS).
 */
export class PrismaImpersonationSessionRepository implements ImpersonationSessionRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async findById(id: string): Promise<ImpersonationSession | null> {
		const row = await this.db.impersonationSession.findUnique({ where: { id } });
		if (row === null) {
			return null;
		}
		return ImpersonationSession.rehydrate({
			id: row.id,
			impersonatorId: row.impersonatorId,
			targetUserId: row.targetUserId,
			startedAt: epochMs(Number(row.startedAt)),
			expiresAt: epochMs(Number(row.expiresAt)),
			endedAt: epochOrNull(row.endedAt),
			endedBy: row.endedBy,
			ipAddress: row.ipAddress,
			userAgent: row.userAgent,
			supportAccessGrantIds: row.supportAccessGrantIds,
		});
	}

	public async hasLiveSessionFor(impersonatorId: string, now: EpochMs): Promise<boolean> {
		return (await this.db.impersonationSession.findFirst({ where: { impersonatorId, endedAt: null, expiresAt: { gt: now } }, select: { id: true } })) !== null;
	}

	public async add(session: ImpersonationSession): Promise<void> {
		const state = session.snapshot;
		await this.db.impersonationSession.create({
			data: {
				id: state.id,
				impersonatorId: state.impersonatorId,
				targetUserId: state.targetUserId,
				startedAt: state.startedAt,
				expiresAt: state.expiresAt,
				ipAddress: state.ipAddress,
				userAgent: state.userAgent,
				supportAccessGrantIds: [...state.supportAccessGrantIds],
			},
		});
		await this.appendAudits(session);
	}

	public async saveEnded(session: ImpersonationSession): Promise<void> {
		const state = session.snapshot;
		if (!session.wasEnded || state.endedAt === null) {
			return;
		}
		const ended = await this.db.impersonationSession.updateMany({
			where: { id: state.id, impersonatorId: state.impersonatorId, targetUserId: state.targetUserId, endedAt: null },
			data: { endedAt: state.endedAt, endedBy: state.endedBy, endReason: "STOPPED", updatedAt: state.endedAt },
		});
		if (ended.count !== 1) {
			throw new ImpersonationSessionInvalidError();
		}
		await this.appendAudits(session);
	}

	private async appendAudits(session: ImpersonationSession): Promise<void> {
		const state = session.snapshot;
		for (const entry of session.pendingAudits) {
			await this.appendAudit(state.impersonatorId, state.targetUserId, state.id, entry);
		}
	}

	private async appendAudit(impersonatorId: string, targetUserId: string, sessionId: string, entry: ImpersonationAuditEntry): Promise<void> {
		await this.db.impersonationAuditLog.create({
			data: { impersonatorId, targetUserId, sessionId, action: entry.action, ipAddress: entry.ipAddress, userAgent: entry.userAgent },
		});
	}
}
