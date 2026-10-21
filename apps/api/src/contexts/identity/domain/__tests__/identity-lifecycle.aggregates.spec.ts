import { describe, expect, it } from "vitest";
import { epochMs, type EpochMs } from "@workspace/shared";

import { IMPERSONATION_SESSION_TTL_MS, ImpersonationSession, type ImpersonationParty, type ImpersonationSessionState } from "../aggregates/impersonation-session.aggregate";
import { MfaRecoveryAuditAction, MfaRecoveryRequest, type MfaRecoveryRequestState } from "../aggregates/mfa-recovery-request.aggregate";
import { UserProfile } from "../aggregates/user-profile.aggregate";
import { PASSWORD_RESET_TOKEN_TTL_MS, PasswordResetToken } from "../entities/password-reset-token.entity";
import {
	CannotImpersonateSelfError,
	ImpersonationAlreadyActiveError,
	ImpersonationSessionInvalidError,
	ImpersonationTargetInactiveError,
	ImpersonationTargetNotFoundError,
	ImpersonationTargetSuperAdminError,
	ImpersonatorAccountNotFoundError,
	ImpersonatorNotEligibleError,
	ImpersonatorNotSuperAdminError,
	MfaRecoveryAlreadyOpenError,
	MfaRecoveryNotPendingError,
	MfaRecoveryRequiresTwoFactorError,
	MfaRecoveryReviewerNotEligibleError,
	MfaRecoverySelfReviewError,
	PasswordResetTokenInvalidError,
} from "../errors/identity.errors";
import { ImpersonationStarted, ImpersonationStopped, UserCredentialsChanged, UserProfileChanged } from "../events/identity.events";
import { BACKGROUND_AUDIT_ORIGIN, type AuditOrigin } from "../value-objects/audit-origin.value-object";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

const NOW: EpochMs = epochMs(1_800_000_000_000);
const DELAY_MS = 86_400_000;
const ORIGIN: AuditOrigin = { correlationId: "corr-1", ipAddress: "198.51.100.7", userAgent: "Firefox", impersonatorId: null };

describe("MfaRecoveryRequest", () => {
	function open(overrides: { readonly userHasTwoFactor?: boolean; readonly userHasOpenRequest?: boolean } = {}): MfaRecoveryRequest {
		return MfaRecoveryRequest.open(
			{ id: "req-1", userId: "user-1", notes: "lost phone", userHasTwoFactor: true, userHasOpenRequest: false, origin: ORIGIN, ...overrides },
			NOW,
		);
	}

	function stored(overrides: Partial<MfaRecoveryRequestState> = {}): MfaRecoveryRequest {
		return MfaRecoveryRequest.rehydrate({
			id: "req-1",
			userId: "user-1",
			status: "APPROVED",
			requestedAt: NOW,
			reviewedBy: "admin-1",
			reviewedAt: NOW,
			scheduledUnlockAt: epochMs(NOW + DELAY_MS),
			completedAt: null,
			notes: null,
			...overrides,
		});
	}

	it("opens a pending request with its audit row, only for an account with 2FA and no open request", () => {
		const request = open();

		expect(request.snapshot.status).toBe("PENDING");
		expect(request.concurrencyToken).toBeNull();
		expect(request.pendingAudits).toEqual([{ action: MfaRecoveryAuditAction.REQUESTED, actorUserId: "user-1", fromStatus: null, toStatus: "PENDING", origin: ORIGIN }]);
		expect(() => open({ userHasTwoFactor: false })).toThrow(MfaRecoveryRequiresTwoFactorError);
		expect(() => open({ userHasOpenRequest: true })).toThrow(MfaRecoveryAlreadyOpenError);
	});

	it("approves with the security delay before the unlock, recording the reviewer", () => {
		const request = open();

		request.review({ userId: "admin-1", isEligibleSuperAdmin: true }, "APPROVED", { recoveryDelayMs: DELAY_MS, notes: "verified by phone", origin: ORIGIN }, NOW);

		expect(request.snapshot).toMatchObject({ status: "APPROVED", reviewedBy: "admin-1", scheduledUnlockAt: NOW + DELAY_MS, notes: "verified by phone" });
		expect(request.pendingAudits.at(-1)).toMatchObject({ action: MfaRecoveryAuditAction.APPROVED, actorUserId: "admin-1", fromStatus: "PENDING" });
	});

	it("denies without an unlock time, keeping the requester's notes when the reviewer adds none", () => {
		const request = open();

		request.review({ userId: "admin-1", isEligibleSuperAdmin: true }, "DENIED", { recoveryDelayMs: DELAY_MS, notes: undefined, origin: ORIGIN }, NOW);

		expect(request.snapshot).toMatchObject({ status: "DENIED", scheduledUnlockAt: null, notes: "lost phone" });
	});

	it("refuses a self-review, an ineligible reviewer and a request that is not pending", () => {
		const input = { recoveryDelayMs: DELAY_MS, notes: undefined, origin: ORIGIN };
		expect(() => {
			open().review({ userId: "user-1", isEligibleSuperAdmin: true }, "APPROVED", input, NOW);
		}).toThrow(MfaRecoverySelfReviewError);
		expect(() => {
			open().review({ userId: "admin-1", isEligibleSuperAdmin: false }, "APPROVED", input, NOW);
		}).toThrow(MfaRecoveryReviewerNotEligibleError);
		expect(() => {
			stored().review({ userId: "admin-2", isEligibleSuperAdmin: true }, "DENIED", input, NOW);
		}).toThrow(MfaRecoveryNotPendingError);
	});

	it("completes only once due, audited as the reviewer, dropping the user's credentials everywhere", () => {
		const request = stored();

		expect(request.complete(BACKGROUND_AUDIT_ORIGIN, NOW)).toBe(false);
		expect(request.complete(BACKGROUND_AUDIT_ORIGIN, epochMs(NOW + DELAY_MS))).toBe(true);
		expect(request.snapshot).toMatchObject({ status: "COMPLETED", completedAt: NOW + DELAY_MS });
		expect(request.pendingAudits).toEqual([expect.objectContaining({ action: MfaRecoveryAuditAction.COMPLETED, actorUserId: "admin-1" })]);
		expect(request.pullEvents()).toEqual([expect.any(UserCredentialsChanged)]);
	});

	it("refuses an APPROVED row without reviewer or unlock time as corrupt", () => {
		expect(() => stored({ reviewedBy: null })).toThrow(CorruptAggregateStateError);
		expect(() => stored({ scheduledUnlockAt: null })).toThrow(CorruptAggregateStateError);
	});
});

describe("ImpersonationSession", () => {
	const ADMIN: ImpersonationParty = { userId: "admin-1", isSuperAdmin: true, isActive: true, isDeleted: false };
	const TARGET: ImpersonationParty = { userId: "user-1", isSuperAdmin: false, isActive: true, isDeleted: false };

	function start(
		overrides: {
			readonly impersonator?: ImpersonationParty | null;
			readonly target?: ImpersonationParty | null;
			readonly targetUserId?: string;
			readonly live?: boolean;
		} = {},
	): ImpersonationSession {
		return ImpersonationSession.start(
			{
				id: "imp-1",
				impersonator: overrides.impersonator === undefined ? ADMIN : overrides.impersonator,
				target: overrides.target === undefined ? TARGET : overrides.target,
				targetUserId: overrides.targetUserId ?? "user-1",
				impersonatorHasLiveSession: overrides.live ?? false,
				supportAccessGrantIds: ["grant-1"],
				origin: ORIGIN,
				actionStartedAt: NOW,
			},
			NOW,
		);
	}

	it("starts a time-boxed session with its START audit row and event", () => {
		const session = start();

		expect(session.snapshot).toMatchObject({
			impersonatorId: "admin-1",
			targetUserId: "user-1",
			expiresAt: NOW + IMPERSONATION_SESSION_TTL_MS,
			endedAt: null,
			supportAccessGrantIds: ["grant-1"],
		});
		expect(session.isLiveAt(NOW)).toBe(true);
		expect(session.isLiveAt(epochMs(NOW + IMPERSONATION_SESSION_TTL_MS))).toBe(false);
		expect(session.pendingAudits).toEqual([{ action: "START", ipAddress: ORIGIN.ipAddress, userAgent: ORIGIN.userAgent }]);
		expect(session.pullEvents()).toEqual([expect.any(ImpersonationStarted)]);
	});

	it("refuses an ineligible impersonator, self-impersonation and an unusable target", () => {
		expect(() => start({ impersonator: null })).toThrow(ImpersonatorNotSuperAdminError);
		expect(() => start({ impersonator: { ...ADMIN, isActive: false } })).toThrow(ImpersonatorNotSuperAdminError);
		expect(() => start({ targetUserId: "admin-1" })).toThrow(CannotImpersonateSelfError);
		expect(() => start({ target: null })).toThrow(ImpersonationTargetNotFoundError);
		expect(() => start({ target: { ...TARGET, isDeleted: true } })).toThrow(ImpersonationTargetInactiveError);
		expect(() => start({ target: { ...TARGET, isSuperAdmin: true } })).toThrow(ImpersonationTargetSuperAdminError);
	});

	it("refuses a second live session for the same administrator (D36)", () => {
		expect(() => start({ live: true })).toThrow(ImpersonationAlreadyActiveError);
	});

	it("stops once, for the claims it was started with", () => {
		const stored: ImpersonationSessionState = { ...start().snapshot };
		const session = ImpersonationSession.rehydrate(stored);

		expect(() => {
			session.stop({ impersonatorId: "admin-2", targetUserId: "user-1" }, ORIGIN, NOW, NOW);
		}).toThrow(ImpersonationSessionInvalidError);
		session.stop({ impersonatorId: "admin-1", targetUserId: "user-1" }, ORIGIN, NOW, NOW);
		expect(session.wasEnded).toBe(true);
		expect(session.snapshot).toMatchObject({ endedAt: NOW, endedBy: "admin-1" });
		expect(session.pullEvents()).toEqual([expect.any(ImpersonationStopped)]);
		expect(() => {
			session.stop({ impersonatorId: "admin-1", targetUserId: "user-1" }, ORIGIN, NOW, NOW);
		}).toThrow(ImpersonationSessionInvalidError);
	});

	it("restores only an existing, still-eligible administrator", () => {
		expect(() => {
			ImpersonationSession.assertImpersonatorRestorable(null);
		}).toThrow(ImpersonatorAccountNotFoundError);
		expect(() => {
			ImpersonationSession.assertImpersonatorRestorable({ ...ADMIN, isSuperAdmin: false });
		}).toThrow(ImpersonatorNotEligibleError);
		expect(() => {
			ImpersonationSession.assertImpersonatorRestorable(ADMIN);
		}).not.toThrow();
	});

	it("refuses a stored session that expires before it starts", () => {
		expect(() => ImpersonationSession.rehydrate({ ...start().snapshot, expiresAt: epochMs(NOW - 1) })).toThrow(CorruptAggregateStateError);
	});
});

describe("UserProfile", () => {
	it("edits against the version the client read and moves to the next version", () => {
		const profile = UserProfile.rehydrate({ userId: "user-1", fullName: "Jane", version: 3 });

		profile.edit(3, { fullName: "Jane Doe" }, NOW);

		expect(profile.concurrencyToken).toBe(3);
		expect(profile.changes).toEqual({ fullName: "Jane Doe" });
		expect(profile.pullEvents()).toEqual([expect.any(UserProfileChanged)]);
	});

	it("keeps an empty edit empty (only the version moves)", () => {
		const profile = UserProfile.rehydrate({ userId: "user-1", fullName: "Jane", version: 0 });

		profile.edit(0, {}, NOW);

		expect(profile.changes).toEqual({});
	});

	it("refuses an invalid stored version", () => {
		expect(() => UserProfile.rehydrate({ userId: "user-1", fullName: "Jane", version: -1 })).toThrow(CorruptAggregateStateError);
	});
});

describe("PasswordResetToken", () => {
	it("is usable once until it expires", () => {
		const token = PasswordResetToken.issue({ id: "t-1", userId: "user-1", tokenHash: "hash", tokenDigest: "digest" }, NOW);

		expect(token.snapshot.expiresAt).toBe(NOW + PASSWORD_RESET_TOKEN_TTL_MS);
		expect(token.isUsableAt(epochMs(NOW + PASSWORD_RESET_TOKEN_TTL_MS))).toBe(true);
		expect(token.isUsableAt(epochMs(NOW + PASSWORD_RESET_TOKEN_TTL_MS + 1))).toBe(false);
		token.consume(NOW);
		expect(token.snapshot.usedAt).toBe(NOW);
		expect(() => {
			token.consume(NOW);
		}).toThrow(PasswordResetTokenInvalidError);
	});

	it("refuses a stored token without its hashes", () => {
		expect(() => PasswordResetToken.rehydrate({ id: "t-1", userId: "user-1", tokenHash: "", tokenDigest: "d", expiresAt: NOW, usedAt: null })).toThrow(
			CorruptAggregateStateError,
		);
	});
});
