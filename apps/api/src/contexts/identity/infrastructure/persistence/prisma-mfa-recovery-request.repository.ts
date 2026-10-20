import type { Prisma } from "@prisma/client";
import { epochMs, type EpochMs } from "@workspace/shared";

import { MfaRecoveryRequest, type MfaRecoveryAuditEntry, type MfaRecoveryStatus } from "../../domain/aggregates/mfa-recovery-request.aggregate";
import { MfaRecoveryNotPendingError } from "../../domain/errors/identity.errors";
import type { MfaRecoveryRequestRepository } from "../../domain/repositories/mfa-recovery-request.repository";
import { epochOrNull } from "./identity-row.mappers";
import { CLEARED_TWO_FACTOR_COLUMNS, retireBackupCodes } from "./prisma-two-factor.repository";

/** Statuses of a request that is still open — at most one per user. */
const OPEN_STATUSES: MfaRecoveryStatus[] = ["PENDING", "APPROVED"];

/** Namespace of the per-user advisory lock that serializes opening a recovery request. */
const OPEN_REQUEST_LOCK_NAMESPACE = "mfa_recovery.open:";

/**
 * MFA recovery persistence. Every transition is a compare-and-set on `status` and commits with its
 * audit row in `MfaRecoveryAuditLog` (bypass-only: callers run under an allowlisted operation).
 */
export class PrismaMfaRecoveryRequestRepository implements MfaRecoveryRequestRepository {
	public constructor(private readonly db: Prisma.TransactionClient) {}

	public async lockOpeningFor(userId: string): Promise<void> {
		const lockKey = `${OPEN_REQUEST_LOCK_NAMESPACE}${userId}`;
		await this.db.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
	}

	public async hasOpenRequest(userId: string): Promise<boolean> {
		return (await this.db.mfaRecoveryRequest.findFirst({ where: { userId, status: { in: OPEN_STATUSES } }, select: { id: true } })) !== null;
	}

	public async findById(id: string): Promise<MfaRecoveryRequest | null> {
		const row = await this.db.mfaRecoveryRequest.findUnique({ where: { id } });
		if (row === null) {
			return null;
		}
		return MfaRecoveryRequest.rehydrate({
			id: row.id,
			userId: row.userId,
			status: row.status,
			requestedAt: epochMs(Number(row.requestedAt)),
			reviewedBy: row.reviewedBy,
			reviewedAt: epochOrNull(row.reviewedAt),
			scheduledUnlockAt: epochOrNull(row.scheduledUnlockAt),
			completedAt: epochOrNull(row.completedAt),
			notes: row.notes,
		});
	}

	public async findDueApprovedIds(now: EpochMs): Promise<readonly string[]> {
		const rows = await this.db.mfaRecoveryRequest.findMany({ where: { status: "APPROVED", scheduledUnlockAt: { lte: now } }, select: { id: true } });
		return rows.map((row): string => row.id);
	}

	public async add(request: MfaRecoveryRequest): Promise<void> {
		const state = request.snapshot;
		await this.db.mfaRecoveryRequest.create({ data: { id: state.id, userId: state.userId, status: state.status, requestedAt: state.requestedAt, notes: state.notes } });
		await this.appendAudits(request);
	}

	public async save(request: MfaRecoveryRequest): Promise<boolean> {
		const state = request.snapshot;
		if (request.concurrencyToken === "PENDING" && state.status !== "PENDING") {
			const reviewedAt: EpochMs = state.reviewedAt ?? state.requestedAt;
			const transitioned = await this.db.mfaRecoveryRequest.updateMany({
				where: { id: state.id, status: "PENDING" },
				data: {
					status: state.status,
					reviewedBy: state.reviewedBy,
					reviewedAt: state.reviewedAt,
					scheduledUnlockAt: state.scheduledUnlockAt,
					notes: state.notes,
					updatedAt: reviewedAt,
				},
			});
			if (transitioned.count !== 1) {
				throw new MfaRecoveryNotPendingError();
			}
			await this.appendAudits(request);
			return true;
		}
		if (request.concurrencyToken === "APPROVED" && state.status === "COMPLETED" && state.completedAt !== null && state.reviewedBy !== null) {
			const completedAt: EpochMs = state.completedAt;
			const transitioned = await this.db.mfaRecoveryRequest.updateMany({
				where: { id: state.id, status: "APPROVED", scheduledUnlockAt: { lte: completedAt } },
				data: { status: "COMPLETED", completedAt, updatedAt: completedAt },
			});
			if (transitioned.count !== 1) {
				return false;
			}
			// The second factor is cleared and every access token re-validated (`tokenVersion` moves).
			await this.db.user.update({ where: { id: state.userId }, data: { ...CLEARED_TWO_FACTOR_COLUMNS, tokenVersion: { increment: 1 }, updatedAt: completedAt } });
			// Soft-deleted, attributed to the approving SuperAdmin (the actor of this unlock).
			await retireBackupCodes(this.db, state.userId, state.reviewedBy, completedAt);
			await this.db.twoFactorPendingSetup.deleteMany({ where: { userId: state.userId } });
			await this.appendAudits(request);
			return true;
		}
		return false;
	}

	private async appendAudits(request: MfaRecoveryRequest): Promise<void> {
		for (const entry of request.pendingAudits) {
			await this.appendAudit(request, entry);
		}
	}

	private async appendAudit(request: MfaRecoveryRequest, entry: MfaRecoveryAuditEntry): Promise<void> {
		await this.db.mfaRecoveryAuditLog.create({
			data: {
				requestId: request.id,
				subjectUserId: request.userId,
				actorUserId: entry.actorUserId,
				action: entry.action,
				fromStatus: entry.fromStatus,
				toStatus: entry.toStatus,
				impersonatorId: entry.origin.impersonatorId,
				correlationId: entry.origin.correlationId,
				ipAddress: entry.origin.ipAddress,
				userAgent: entry.origin.userAgent,
			},
		});
	}
}
