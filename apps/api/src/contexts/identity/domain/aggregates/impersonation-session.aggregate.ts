import { epochMs, type EpochMs } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import {
	CannotImpersonateSelfError,
	CorruptIdentityStateError,
	ImpersonationAlreadyActiveError,
	ImpersonationSessionInvalidError,
	ImpersonationTargetInactiveError,
	ImpersonationTargetNotFoundError,
	ImpersonationTargetSuperAdminError,
	ImpersonatorAccountNotFoundError,
	ImpersonatorNotEligibleError,
	ImpersonatorNotSuperAdminError,
} from "../errors/identity.errors";
import { ImpersonationStarted, ImpersonationStopped, type IdentityEvent } from "../events/identity.events";
import type { AuditOrigin } from "../value-objects/audit-origin.value-object";

/** Milliseconds per second. */
const MS_PER_SECOND = 1000;

/** Lifetime of an impersonation access token and of its server-side session: 15 minutes. */
export const IMPERSONATION_TOKEN_TTL_SECONDS = 900;

/** The session lifetime in milliseconds. */
export const IMPERSONATION_SESSION_TTL_MS = IMPERSONATION_TOKEN_TTL_SECONDS * MS_PER_SECOND;

/** `ImpersonationAuditLog.action` values (byte-stable: seeds and readers use them). */
export const ImpersonationAuditAction = {
	START: "START",
	STOP: "STOP",
} satisfies Record<string, string>;

/** The account facts that decide who may impersonate whom. */
export interface ImpersonationParty {
	readonly userId: string;
	readonly isSuperAdmin: boolean;
	readonly isActive: boolean;
	readonly isDeleted: boolean;
}

export interface ImpersonationSessionState {
	readonly id: string;
	readonly impersonatorId: string;
	readonly targetUserId: string;
	readonly startedAt: EpochMs;
	readonly expiresAt: EpochMs;
	readonly endedAt: EpochMs | null;
	readonly endedBy: string | null;
	readonly ipAddress: string | null;
	readonly userAgent: string | null;
	/** The approved support grants that authorized the session (D21): one per tenant the target belongs to. */
	readonly supportAccessGrantIds: readonly string[];
}

/** One immutable `ImpersonationAuditLog` row a transition writes in its transaction. */
export interface ImpersonationAuditEntry {
	readonly action: string;
	readonly ipAddress: string | null;
	readonly userAgent: string | null;
}

function isEligibleSuperAdmin(party: ImpersonationParty): boolean {
	return party.isSuperAdmin && party.isActive && !party.isDeleted;
}

/**
 * A SuperAdmin acting as another user for a bounded time. The impersonation token is bound to this
 * session; ending it (a compare-and-set on `endedAt IS NULL`) revokes the token server-side.
 *
 * D36: an administrator has at most one live session. Starting one takes a row lock on the
 * impersonator's account first, so two concurrent starts are serialized and the second one sees
 * the first session and is refused ({@link ImpersonationAlreadyActiveError}).
 */
export class ImpersonationSession extends AggregateRoot<IdentityEvent> {
	private readonly audits: ImpersonationAuditEntry[] = [];
	private endedNow = false;

	private constructor(
		private state: ImpersonationSessionState,
		public readonly isNew: boolean,
	) {
		super();
	}

	/**
	 * Starts a session. Every rule of who may impersonate whom is checked here, in the order the API
	 * has always reported them; `impersonatorHasLiveSession` was read under the impersonator's row lock.
	 */
	public static start(
		input: {
			readonly id: string;
			readonly impersonator: ImpersonationParty | null;
			readonly target: ImpersonationParty | null;
			readonly targetUserId: string;
			readonly impersonatorHasLiveSession: boolean;
			/** The grants `assertImpersonationGrants` found covering every tenant of the target. */
			readonly supportAccessGrantIds: readonly string[];
			readonly origin: AuditOrigin;
			readonly actionStartedAt: EpochMs;
		},
		now: EpochMs,
	): ImpersonationSession {
		const impersonator: ImpersonationParty | null = input.impersonator;
		if (impersonator === null || !isEligibleSuperAdmin(impersonator)) {
			throw new ImpersonatorNotSuperAdminError();
		}
		if (impersonator.userId === input.targetUserId) {
			throw new CannotImpersonateSelfError();
		}
		const target: ImpersonationParty | null = input.target;
		if (target === null) {
			throw new ImpersonationTargetNotFoundError();
		}
		if (!target.isActive || target.isDeleted) {
			throw new ImpersonationTargetInactiveError();
		}
		if (target.isSuperAdmin) {
			throw new ImpersonationTargetSuperAdminError();
		}
		if (input.impersonatorHasLiveSession) {
			throw new ImpersonationAlreadyActiveError();
		}
		const session = new ImpersonationSession(
			{
				id: input.id,
				impersonatorId: impersonator.userId,
				targetUserId: target.userId,
				startedAt: now,
				expiresAt: epochMs(now + IMPERSONATION_SESSION_TTL_MS),
				endedAt: null,
				endedBy: null,
				ipAddress: input.origin.ipAddress,
				userAgent: input.origin.userAgent,
				supportAccessGrantIds: input.supportAccessGrantIds,
			},
			true,
		);
		session.audits.push({ action: ImpersonationAuditAction.START, ipAddress: input.origin.ipAddress, userAgent: input.origin.userAgent });
		session.record(new ImpersonationStarted(impersonator.userId, target.userId, input.id, input.actionStartedAt, now));
		return session;
	}

	public static rehydrate(state: ImpersonationSessionState): ImpersonationSession {
		if (state.expiresAt < state.startedAt) {
			throw new CorruptIdentityStateError("impersonation_session", `session ${state.id} expires before it starts`);
		}
		return new ImpersonationSession(state, false);
	}

	/** Restoring the administrator at stop: they must still be an active SuperAdmin, or nothing is restored. */
	public static assertImpersonatorRestorable(impersonator: ImpersonationParty | null): void {
		if (impersonator === null) {
			throw new ImpersonatorAccountNotFoundError();
		}
		if (!isEligibleSuperAdmin(impersonator)) {
			throw new ImpersonatorNotEligibleError();
		}
	}

	public get id(): string {
		return this.state.id;
	}

	public get snapshot(): ImpersonationSessionState {
		return this.state;
	}

	public get pendingAudits(): readonly ImpersonationAuditEntry[] {
		return this.audits;
	}

	/** Whether {@link ImpersonationSession.stop} ended the session in this unit of work (stored conditionally). */
	public get wasEnded(): boolean {
		return this.endedNow;
	}

	/** Live at `now`: not ended and not expired. */
	public isLiveAt(now: EpochMs): boolean {
		return this.state.endedAt === null && this.state.expiresAt > now;
	}

	/**
	 * The impersonator stops. Refused (and nothing written) when the session is not this pair's or
	 * already ended. An expired session can still be stopped (it records the STOP row).
	 */
	public stop(claims: { readonly impersonatorId: string; readonly targetUserId: string }, origin: AuditOrigin, actionStartedAt: EpochMs, now: EpochMs): void {
		if (claims.impersonatorId !== this.state.impersonatorId || claims.targetUserId !== this.state.targetUserId || this.state.endedAt !== null) {
			throw new ImpersonationSessionInvalidError();
		}
		this.state = { ...this.state, endedAt: now, endedBy: claims.impersonatorId };
		this.endedNow = true;
		this.audits.push({ action: ImpersonationAuditAction.STOP, ipAddress: origin.ipAddress, userAgent: origin.userAgent });
		this.record(new ImpersonationStopped(this.state.impersonatorId, this.state.targetUserId, this.state.id, actionStartedAt, now));
	}
}
