import { Injectable } from "@nestjs/common";
import { MfaRecoveryRequestStatus, type MfaRecoveryRequest } from "@prisma/client";

import { RequestContextService, type RequestContext } from "../../../common/context/request-context";
import { TenantTransactionService } from "../../../prisma/tenant-transaction.service";

/** `mfa_recovery_audit_logs.action` values of the MFA recovery lifecycle. */
export const MfaRecoveryAuditAction = {
	REQUESTED: "mfa_recovery.requested",
	APPROVED: "mfa_recovery.approved",
	DENIED: "mfa_recovery.denied",
	COMPLETED: "mfa_recovery.completed",
} satisfies Record<string, string>;

/** Statuses of a request that is still open — at most one per user. */
const OPEN_STATUSES: MfaRecoveryRequestStatus[] = [MfaRecoveryRequestStatus.PENDING, MfaRecoveryRequestStatus.APPROVED];

/** Namespace of the per-user advisory lock that serializes opening a recovery request. */
const OPEN_REQUEST_LOCK_NAMESPACE = "mfa_recovery.open:";

/** The transaction client `TenantTransactionService.withSystemOperation` hands out. */
type MfaRecoveryTx = Parameters<Parameters<TenantTransactionService["withSystemOperation"]>[1]>[0];

export type OpenRecoveryResult = { readonly kind: "opened"; readonly request: MfaRecoveryRequest } | { readonly kind: "already_open" };

export type ReviewDecision = typeof MfaRecoveryRequestStatus.APPROVED | typeof MfaRecoveryRequestStatus.DENIED;

export interface ReviewRecoveryInput {
	readonly requestId: string;
	readonly reviewerId: string;
	readonly decision: ReviewDecision;
	readonly reviewedAt: number;
	/** Required for an approval (when MFA is cleared), `null` for a denial. */
	readonly scheduledUnlockAt: number | null;
	readonly notes: string | undefined;
}

export type ReviewRecoveryResult =
	| { readonly kind: "reviewed"; readonly request: MfaRecoveryRequest }
	| { readonly kind: "not_found" }
	| { readonly kind: "not_pending" }
	| { readonly kind: "self_review" }
	| { readonly kind: "reviewer_not_eligible" };

export type CompleteRecoveryResult = { readonly kind: "completed"; readonly userId: string; readonly reviewerId: string } | { readonly kind: "not_due" };

/**
 * Persistence for the MFA recovery lifecycle. Every state change is a
 * compare-and-set on `status` and commits atomically with its audit row in
 * `mfa_recovery_audit_logs` (actor = the real user: the requester, or the
 * reviewing SuperAdmin). The audit table is bypass-only, so each write runs
 * under an allowlisted system operation.
 */
@Injectable()
export class MfaRecoveryRepository {
	public constructor(
		private readonly tenantTx: TenantTransactionService,
		private readonly requestContext: RequestContextService,
	) {}

	/**
	 * Open a PENDING request unless the user already has an open one. A
	 * transaction-scoped advisory lock per user serializes concurrent opens,
	 * so the check and the insert cannot interleave.
	 */
	public async openRequest(userId: string, notes: string | null, requestedAt: number): Promise<OpenRecoveryResult> {
		return this.tenantTx.withSystemOperation(
			{ operation: "auth.mfa_recovery.request", reason: "User opens an MFA recovery request", actorUserId: userId },
			async (tx): Promise<OpenRecoveryResult> => {
				const lockKey = `${OPEN_REQUEST_LOCK_NAMESPACE}${userId}`;
				await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

				const open = await tx.mfaRecoveryRequest.findFirst({ where: { userId, status: { in: OPEN_STATUSES } }, select: { id: true } });
				if (open !== null) {
					return { kind: "already_open" };
				}

				const request = await tx.mfaRecoveryRequest.create({
					data: { userId, status: MfaRecoveryRequestStatus.PENDING, requestedAt, notes },
				});
				await this.appendAudit(tx, {
					action: MfaRecoveryAuditAction.REQUESTED,
					requestId: request.id,
					actorUserId: userId,
					subjectUserId: userId,
					fromStatus: null,
					toStatus: MfaRecoveryRequestStatus.PENDING,
				});
				return { kind: "opened", request };
			},
		);
	}

	/**
	 * Approve or deny a PENDING request. The reviewer must be an active,
	 * non-deleted SuperAdmin and NOT the requester; the transition is a
	 * compare-and-set on `status = PENDING`, so two concurrent reviews cannot
	 * both win.
	 */
	public async review(input: ReviewRecoveryInput): Promise<ReviewRecoveryResult> {
		return this.tenantTx.withSystemOperation(
			{ operation: "auth.mfa_recovery.review", reason: `SuperAdmin ${input.decision} an MFA recovery request`, actorUserId: input.reviewerId },
			async (tx): Promise<ReviewRecoveryResult> => {
				const request = await tx.mfaRecoveryRequest.findUnique({ where: { id: input.requestId }, select: { id: true, userId: true } });
				if (request === null) {
					return { kind: "not_found" };
				}
				if (request.userId === input.reviewerId) {
					return { kind: "self_review" };
				}

				const reviewer = await tx.user.findFirst({
					where: { id: input.reviewerId, isSuperAdmin: true, isActive: true, isDeleted: false },
					select: { id: true },
				});
				if (reviewer === null) {
					return { kind: "reviewer_not_eligible" };
				}

				const transitioned = await tx.mfaRecoveryRequest.updateMany({
					where: { id: input.requestId, status: MfaRecoveryRequestStatus.PENDING },
					data: {
						status: input.decision,
						reviewedBy: input.reviewerId,
						reviewedAt: input.reviewedAt,
						scheduledUnlockAt: input.scheduledUnlockAt,
						...(input.notes === undefined ? {} : { notes: input.notes }),
						updatedAt: input.reviewedAt,
					},
				});
				if (transitioned.count !== 1) {
					return { kind: "not_pending" };
				}

				await this.appendAudit(tx, {
					action: input.decision === MfaRecoveryRequestStatus.APPROVED ? MfaRecoveryAuditAction.APPROVED : MfaRecoveryAuditAction.DENIED,
					requestId: input.requestId,
					actorUserId: input.reviewerId,
					subjectUserId: request.userId,
					fromStatus: MfaRecoveryRequestStatus.PENDING,
					toStatus: input.decision,
				});
				const reviewed = await tx.mfaRecoveryRequest.findUniqueOrThrow({ where: { id: input.requestId } });
				return { kind: "reviewed", request: reviewed };
			},
		);
	}

	/** APPROVED requests whose security delay has elapsed at `now`. */
	public async findDueApproved(now: number): Promise<Pick<MfaRecoveryRequest, "id">[]> {
		return this.tenantTx.withSystemOperation({ operation: "maintenance.mfa_recovery_unlock", reason: "List due MFA recovery unlocks", actorUserId: null }, async (tx) =>
			tx.mfaRecoveryRequest.findMany({
				where: { status: MfaRecoveryRequestStatus.APPROVED, scheduledUnlockAt: { lte: now } },
				select: { id: true },
			}),
		);
	}

	/**
	 * Complete a due APPROVED request: compare-and-set it to COMPLETED, clear
	 * the user's MFA (bumping `tokenVersion` so every access token is
	 * re-validated), soft-delete their backup codes (`deletedBy` = the approving
	 * SuperAdmin, the actor of this unlock) and record the audit row — one
	 * transaction. `not_due` when another worker already completed it.
	 */
	public async complete(requestId: string, now: number): Promise<CompleteRecoveryResult> {
		return this.tenantTx.withSystemOperation(
			{ operation: "maintenance.mfa_recovery_unlock", reason: "Apply a due MFA recovery unlock", actorUserId: null },
			async (tx): Promise<CompleteRecoveryResult> => {
				const request = await tx.mfaRecoveryRequest.findUnique({ where: { id: requestId }, select: { userId: true, reviewedBy: true } });
				if (request === null) {
					return { kind: "not_due" };
				}
				if (request.reviewedBy === null) {
					throw new MfaRecoveryIntegrityError(requestId);
				}
				const reviewerId: string = request.reviewedBy;

				const transitioned = await tx.mfaRecoveryRequest.updateMany({
					where: { id: requestId, status: MfaRecoveryRequestStatus.APPROVED, scheduledUnlockAt: { lte: now } },
					data: { status: MfaRecoveryRequestStatus.COMPLETED, completedAt: now, updatedAt: now },
				});
				if (transitioned.count !== 1) {
					return { kind: "not_due" };
				}

				await tx.user.update({
					where: { id: request.userId },
					data: {
						twoFactorEnabled: false,
						twoFactorSecretCiphertext: null,
						twoFactorSecretIv: null,
						twoFactorSecretKeyVersion: null,
						twoFactorLastTotpStep: null,
						mfaAssuredAt: null,
						mfaEnrolledAt: null,
						tokenVersion: { increment: 1 },
						updatedAt: now,
					},
				});
				await tx.backupCode.updateMany({
					where: { userId: request.userId, isDeleted: false },
					data: { isDeleted: true, deletedAt: now, deletedBy: reviewerId },
				});
				// Unconfirmed enrollment state (secret + hashes awaiting the first TOTP) —
				// ephemeral, not a business entity; it must not survive an MFA reset.
				await tx.twoFactorPendingSetup.deleteMany({ where: { userId: request.userId } });
				await this.appendAudit(tx, {
					action: MfaRecoveryAuditAction.COMPLETED,
					requestId,
					actorUserId: reviewerId,
					subjectUserId: request.userId,
					fromStatus: MfaRecoveryRequestStatus.APPROVED,
					toStatus: MfaRecoveryRequestStatus.COMPLETED,
				});
				return { kind: "completed", userId: request.userId, reviewerId };
			},
		);
	}

	private async appendAudit(
		tx: MfaRecoveryTx,
		entry: {
			readonly action: string;
			readonly requestId: string;
			readonly actorUserId: string;
			readonly subjectUserId: string;
			readonly fromStatus: MfaRecoveryRequestStatus | null;
			readonly toStatus: MfaRecoveryRequestStatus;
		},
	): Promise<void> {
		const context: RequestContext | undefined = this.requestContext.current();
		await tx.mfaRecoveryAuditLog.create({
			data: {
				requestId: entry.requestId,
				subjectUserId: entry.subjectUserId,
				actorUserId: entry.actorUserId,
				action: entry.action,
				fromStatus: entry.fromStatus,
				toStatus: entry.toStatus,
				impersonatorId: context?.principal?.impersonatorId ?? null,
				correlationId: context?.correlationId ?? null,
				ipAddress: context?.ip ?? null,
				userAgent: context?.userAgent ?? null,
			},
		});
	}
}

/** An APPROVED recovery request without a reviewer — the row violates the review invariant. */
export class MfaRecoveryIntegrityError extends Error {
	public constructor(public readonly requestId: string) {
		super(`MFA recovery request ${requestId} is APPROVED but has no reviewer`);
		this.name = "MfaRecoveryIntegrityError";
	}
}
