import { epochMs, type EpochMs } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import {
	CorruptIdentityStateError,
	MfaRecoveryAlreadyOpenError,
	MfaRecoveryNotPendingError,
	MfaRecoveryReviewerNotEligibleError,
	MfaRecoveryRequiresTwoFactorError,
	MfaRecoverySelfReviewError,
} from "../errors/identity.errors";
import { UserCredentialsChanged, type IdentityEvent } from "../events/identity.events";
import type { AuditOrigin } from "../value-objects/audit-origin.value-object";

export type MfaRecoveryStatus = "PENDING" | "APPROVED" | "DENIED" | "COMPLETED";

/** A reviewer's decision. */
export type MfaRecoveryDecision = "APPROVED" | "DENIED";

/** `MfaRecoveryAuditLog.action` values of the lifecycle (byte-stable: seeds and readers use them). */
export const MfaRecoveryAuditAction = {
	REQUESTED: "mfa_recovery.requested",
	APPROVED: "mfa_recovery.approved",
	DENIED: "mfa_recovery.denied",
	COMPLETED: "mfa_recovery.completed",
} satisfies Record<string, string>;

export interface MfaRecoveryRequestState {
	readonly id: string;
	readonly userId: string;
	readonly status: MfaRecoveryStatus;
	readonly requestedAt: EpochMs;
	readonly reviewedBy: string | null;
	readonly reviewedAt: EpochMs | null;
	readonly scheduledUnlockAt: EpochMs | null;
	readonly completedAt: EpochMs | null;
	readonly notes: string | null;
}

/** One `MfaRecoveryAuditLog` row a transition writes in its transaction. */
export interface MfaRecoveryAuditEntry {
	readonly action: string;
	readonly actorUserId: string;
	readonly fromStatus: MfaRecoveryStatus | null;
	readonly toStatus: MfaRecoveryStatus;
	readonly origin: AuditOrigin;
}

/** The reviewer as the review saw them: their id and whether they are an active, non-deleted SuperAdmin. */
export interface MfaRecoveryReviewer {
	readonly userId: string;
	readonly isEligibleSuperAdmin: boolean;
}

/**
 * An admin-reviewed request to switch off a user's second factor.
 *
 * Lifecycle `PENDING → APPROVED | DENIED`, then `APPROVED → COMPLETED` once the security delay has
 * elapsed. Every transition is a compare-and-set on the status the request was loaded with
 * ({@link MfaRecoveryRequest.concurrencyToken}) and writes its audit row in the same transaction. At
 * most one open (PENDING or APPROVED) request per user, serialized by a per-user advisory lock.
 */
export class MfaRecoveryRequest extends AggregateRoot<IdentityEvent> {
	private readonly audits: MfaRecoveryAuditEntry[] = [];

	private constructor(
		private state: MfaRecoveryRequestState,
		private readonly loadedStatus: MfaRecoveryStatus | null,
	) {
		super();
	}

	/**
	 * Opens a request. `userHasTwoFactor` and `userHasOpenRequest` are read under the per-user lock,
	 * so the "one open request" rule holds under concurrency.
	 */
	public static open(
		input: {
			readonly id: string;
			readonly userId: string;
			readonly notes: string | null;
			readonly userHasTwoFactor: boolean;
			readonly userHasOpenRequest: boolean;
			readonly origin: AuditOrigin;
		},
		now: EpochMs,
	): MfaRecoveryRequest {
		if (!input.userHasTwoFactor) {
			throw new MfaRecoveryRequiresTwoFactorError();
		}
		if (input.userHasOpenRequest) {
			throw new MfaRecoveryAlreadyOpenError();
		}
		const request = new MfaRecoveryRequest(
			{
				id: input.id,
				userId: input.userId,
				status: "PENDING",
				requestedAt: now,
				reviewedBy: null,
				reviewedAt: null,
				scheduledUnlockAt: null,
				completedAt: null,
				notes: input.notes,
			},
			null,
		);
		request.audits.push({ action: MfaRecoveryAuditAction.REQUESTED, actorUserId: input.userId, fromStatus: null, toStatus: "PENDING", origin: input.origin });
		return request;
	}

	public static rehydrate(state: MfaRecoveryRequestState): MfaRecoveryRequest {
		if (state.status === "APPROVED" && (state.reviewedBy === null || state.scheduledUnlockAt === null)) {
			throw new CorruptIdentityStateError("mfa_recovery_request", `request ${state.id} is APPROVED but has no reviewer or unlock time`);
		}
		return new MfaRecoveryRequest(state, state.status);
	}

	public get id(): string {
		return this.state.id;
	}

	public get userId(): string {
		return this.state.userId;
	}

	public get snapshot(): MfaRecoveryRequestState {
		return this.state;
	}

	/** The status this request was loaded with (null for a new one): transitions compare-and-set on it. */
	public get concurrencyToken(): MfaRecoveryStatus | null {
		return this.loadedStatus;
	}

	/** Audit rows this unit of work owes, in order. */
	public get pendingAudits(): readonly MfaRecoveryAuditEntry[] {
		return this.audits;
	}

	/**
	 * A SuperAdmin approves (MFA is cleared after `recoveryDelayMs`) or denies. The requester may never
	 * review their own request, and only an active SuperAdmin may review at all.
	 */
	public review(
		reviewer: MfaRecoveryReviewer,
		decision: MfaRecoveryDecision,
		input: { readonly recoveryDelayMs: number; readonly notes: string | undefined; readonly origin: AuditOrigin },
		now: EpochMs,
	): void {
		if (reviewer.userId === this.state.userId) {
			throw new MfaRecoverySelfReviewError();
		}
		if (!reviewer.isEligibleSuperAdmin) {
			throw new MfaRecoveryReviewerNotEligibleError();
		}
		if (this.state.status !== "PENDING") {
			throw new MfaRecoveryNotPendingError();
		}
		this.state = {
			...this.state,
			status: decision,
			reviewedBy: reviewer.userId,
			reviewedAt: now,
			scheduledUnlockAt: decision === "APPROVED" ? epochMs(now + input.recoveryDelayMs) : null,
			notes: input.notes ?? this.state.notes,
		};
		this.audits.push({
			action: decision === "APPROVED" ? MfaRecoveryAuditAction.APPROVED : MfaRecoveryAuditAction.DENIED,
			actorUserId: reviewer.userId,
			fromStatus: "PENDING",
			toStatus: decision,
			origin: input.origin,
		});
	}

	/** Whether the approved security delay has elapsed at `now`. */
	public isDueAt(now: EpochMs): boolean {
		return this.state.status === "APPROVED" && this.state.scheduledUnlockAt !== null && this.state.scheduledUnlockAt <= now;
	}

	/**
	 * The approved delay elapsed: the request completes and the user's second factor is cleared (the
	 * repository clears it in the same transaction; the approving SuperAdmin is the actor). Returns
	 * `false` when it is not (or no longer) due.
	 */
	public complete(origin: AuditOrigin, now: EpochMs): boolean {
		if (!this.isDueAt(now)) {
			return false;
		}
		const reviewerId: string | null = this.state.reviewedBy;
		if (reviewerId === null) {
			throw new CorruptIdentityStateError("mfa_recovery_request", `request ${this.state.id} is APPROVED but has no reviewer`);
		}
		this.state = { ...this.state, status: "COMPLETED", completedAt: now };
		this.audits.push({ action: MfaRecoveryAuditAction.COMPLETED, actorUserId: reviewerId, fromStatus: "APPROVED", toStatus: "COMPLETED", origin });
		this.record(new UserCredentialsChanged(this.state.userId, "mfa_recovery_completed", now));
		return true;
	}
}
