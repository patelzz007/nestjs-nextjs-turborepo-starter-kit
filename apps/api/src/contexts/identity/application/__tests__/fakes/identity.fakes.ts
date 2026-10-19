import {
	epochMs,
	type TotpSecretEncryptionContext,
	type CapabilitySlug,
	type EmailSendResult,
	type EpochMs,
	type FlatUserResponse,
	type JsonValue,
	type OwnProfile,
	type RefreshTokenPayload,
	type AccessTokenPayload,
	type UserPermissions,
} from "@workspace/shared";

import type { ActorContext } from "../../../../../platform/application/actor-context";
import type { Clock } from "../../../../../platform/application/clock.port";
import type { SystemOperationName } from "../../../../../platform/application/system-operation-names";
import type { UnitOfWork } from "../../../../../platform/application/unit-of-work.port";
import { TransactionalEventCollector } from "../../../../../platform/application/events/transactional-event-collector";
import type { SlimRole, UserGrantsReadPort } from "../../../../../platform/application/ports/authorization.port";
import type { DefaultRoleAssignmentPort, PlatformRoleAssignmentOutcome, PlatformRoleAssignmentRequest } from "../../../../authorization/public-api";
import type { AcceptedSignupReferral, SignupReferralPort, SignupReferralSummary, TransactionalSignupReferralPort } from "../../../../referrals/public-api";
import { DeviceSession, type DeviceSessionState, type LiveSessionSummary } from "../../../domain/aggregates/device-session.aggregate";
import { ImpersonationSession, type ImpersonationSessionState } from "../../../domain/aggregates/impersonation-session.aggregate";
import { MfaRecoveryRequest, type MfaRecoveryRequestState } from "../../../domain/aggregates/mfa-recovery-request.aggregate";
import type { EncryptedTotpSecret, TotpVerification, TwoFactorEnrollment } from "../../../domain/aggregates/two-factor-enrollment.aggregate";
import { TwoFactorLoginChallenge, type TwoFactorLoginChallengeState } from "../../../domain/aggregates/two-factor-login-challenge.aggregate";
import { UserAccount, type UserAccountState } from "../../../domain/aggregates/user-account.aggregate";
import type { UserProfile } from "../../../domain/aggregates/user-profile.aggregate";
import { PasswordResetToken, type PasswordResetTokenState } from "../../../domain/entities/password-reset-token.entity";
import { EmailAlreadyRegisteredError, MfaRecoveryNotPendingError } from "../../../domain/errors/identity.errors";
import type { DeviceSessionRepository, OwnSessionRevocation, RotationWrite } from "../../../domain/repositories/device-session.repository";
import type { ImpersonationSessionRepository } from "../../../domain/repositories/impersonation-session.repository";
import type { MfaRecoveryRequestRepository } from "../../../domain/repositories/mfa-recovery-request.repository";
import type { PasswordResetTokenRepository } from "../../../domain/repositories/password-reset-token.repository";
import type { FailedChallengeAttempt, TwoFactorEnrollmentRepository, TwoFactorLoginChallengeRepository } from "../../../domain/repositories/two-factor.repository";
import type { UserAccountRepository } from "../../../domain/repositories/user-account.repository";
import type { UserProfileRepository } from "../../../domain/repositories/user-profile.repository";
import type { EmailAddress } from "../../../domain/value-objects/email-address.value-object";
import { LockoutState, type FailedSignInOutcome } from "../../../domain/value-objects/lockout-state.value-object";
import { sessionRevokerColumn, type SessionRevoker } from "../../../domain/value-objects/session-revoker.value-object";
import type { SessionDeviceDetails } from "../../../domain/value-objects/session-device.value-object";
import { TokenVersion } from "../../../domain/value-objects/token-version.value-object";
import type { IdentityScope } from "../../identity-scope";
import type { AuthFlowSubjectPort } from "../../ports/auth-flow.port";
import type { AuthenticatorPort, TotpSecretCipherPort } from "../../ports/authenticator.port";
import type { CredentialCryptoPort } from "../../ports/credential-crypto.port";
import type { IdGeneratorPort } from "../../ports/id-generator.port";
import type { IdentityEmailPort } from "../../ports/identity-email.port";
import type { IdentitySettings } from "../../ports/identity-settings.port";
import type { IdentityTelemetryPort, SessionActionTelemetry } from "../../ports/identity-telemetry.port";
import type { IdentityTokensPort, SessionTokenOptions, SessionTokens, VerifiedChallengeRef } from "../../ports/identity-tokens.port";
import type { RequestAuditPort } from "../../ports/request-audit.port";

export const NOW: EpochMs = epochMs(1_800_000_000_000);
const HOUR_MS = 3_600_000;
const MS_PER_SECOND = 1000;

/** A clock that only moves when the test moves it. */
export class FixedClock implements Clock {
	public constructor(private current: EpochMs = NOW) {}

	public now(): EpochMs {
		return this.current;
	}

	public advance(ms: number): void {
		this.current = epochMs(this.current + ms);
	}
}

/** Accounts kept as snapshots, so a test sees only what a handler saved. */
export class InMemoryUserAccounts implements UserAccountRepository {
	public readonly rows = new Map<string, UserAccountState>();
	public readonly passwordHistory = new Map<string, string[]>();
	public bootstrapLocks = 0;

	public seed(state: UserAccountState): void {
		this.rows.set(state.id, state);
	}

	public findById(id: string): Promise<UserAccount | null> {
		const row: UserAccountState | undefined = this.rows.get(id);
		return Promise.resolve(row === undefined ? null : UserAccount.rehydrate(row));
	}

	public findByEmail(email: EmailAddress): Promise<UserAccount | null> {
		const row: UserAccountState | undefined = [...this.rows.values()].find((candidate: UserAccountState): boolean => candidate.email.equals(email));
		return Promise.resolve(row === undefined ? null : UserAccount.rehydrate(row));
	}

	public lockById(id: string): Promise<UserAccount | null> {
		return this.findById(id);
	}

	public async existsByEmail(email: EmailAddress): Promise<boolean> {
		return (await this.findByEmail(email)) !== null;
	}

	/** Throws `EmailAlreadyRegisteredError` for a taken address, as the unique index makes Prisma do. */
	public add(account: UserAccount): Promise<void> {
		if ([...this.rows.values()].some((row: UserAccountState): boolean => row.email.equals(account.email))) {
			return Promise.reject(new EmailAlreadyRegisteredError());
		}
		this.rows.set(account.id, account.snapshot);
		return Promise.resolve();
	}

	public save(account: UserAccount): Promise<void> {
		this.rows.set(account.id, account.snapshot);
		return Promise.resolve();
	}

	public recordFailedSignIn(userId: string, now: EpochMs): Promise<FailedSignInOutcome | null> {
		const row: UserAccountState | undefined = this.rows.get(userId);
		if (row === undefined) {
			return Promise.resolve(null);
		}
		const outcome: FailedSignInOutcome = row.lockout.afterFailedAttempt(now);
		this.rows.set(userId, { ...row, lockout: outcome.state });
		return Promise.resolve(outcome);
	}

	public resetLockout(userId: string): Promise<void> {
		const row: UserAccountState | undefined = this.rows.get(userId);
		if (row !== undefined) {
			this.rows.set(userId, { ...row, lockout: LockoutState.clear() });
		}
		return Promise.resolve();
	}

	public recentPasswordHashes(userId: string, depth: number): Promise<readonly string[]> {
		return Promise.resolve((this.passwordHistory.get(userId) ?? []).slice(0, depth));
	}

	public bumpTokenVersions(userIds: readonly string[]): Promise<void> {
		for (const userId of userIds) {
			const row: UserAccountState | undefined = this.rows.get(userId);
			if (row !== undefined) {
				this.rows.set(userId, { ...row, tokenVersion: row.tokenVersion.next() });
			}
		}
		return Promise.resolve();
	}

	public lockSuperAdminBootstrap(): Promise<void> {
		this.bootstrapLocks += 1;
		return Promise.resolve();
	}

	public countActiveSuperAdmins(): Promise<number> {
		return Promise.resolve([...this.rows.values()].filter((row: UserAccountState): boolean => row.isSuperAdmin && row.isActive && !row.isDeleted).length);
	}

	public activeSuperAdminEmails(): Promise<readonly EmailAddress[]> {
		return Promise.resolve(
			[...this.rows.values()]
				.filter((row: UserAccountState): boolean => row.isSuperAdmin && row.isActive && !row.isDeleted)
				.map((row: UserAccountState): EmailAddress => row.email),
		);
	}
}

/** Device sessions as stored rows; the rotation is a compare-and-set on the stored digest, as in Postgres. */
export class InMemoryDeviceSessions implements DeviceSessionRepository {
	public readonly rows = new Map<string, DeviceSessionState & { readonly deletedBy: string | null }>();
	private raceRevocation: string | null = null;

	public seed(state: DeviceSessionState): void {
		this.rows.set(state.id, { ...state, deletedBy: null });
	}

	public findById(id: string): Promise<DeviceSession | null> {
		const row = this.rows.get(id);
		return Promise.resolve(row === undefined ? null : DeviceSession.rehydrate(row));
	}

	public add(session: DeviceSession): Promise<void> {
		this.seed(session.snapshot);
		return Promise.resolve();
	}

	/** Simulates a concurrent sign-out that lands between the handler's read and its rotation write. */
	public revokeBeforeNextRotation(sessionId: string): void {
		this.raceRevocation = sessionId;
	}

	public saveRotation(session: DeviceSession, expectedTokenHash: string, now: EpochMs): Promise<RotationWrite> {
		if (this.raceRevocation !== null) {
			this.revoke(this.raceRevocation, { kind: "system", marker: "system:logout-all" });
			this.raceRevocation = null;
		}
		const row = this.rows.get(session.id);
		if (row === undefined || row.isDeleted || row.expiresAt < now || row.tokenHash !== expectedTokenHash) {
			return Promise.resolve({ kind: "lost", current: row ?? null });
		}
		this.rows.set(session.id, { ...session.snapshot, deletedBy: null });
		return Promise.resolve({ kind: "rotated" });
	}

	public liveSessionsOf(userId: string): Promise<readonly LiveSessionSummary[]> {
		return Promise.resolve(
			[...this.rows.values()]
				.filter((row): boolean => row.userId === userId && !row.isDeleted)
				.map((row): LiveSessionSummary => ({ id: row.id, createdAt: row.createdAt, expiresAt: row.expiresAt })),
		);
	}

	public revokeSessions(sessionIds: readonly string[], revoker: SessionRevoker): Promise<void> {
		for (const id of sessionIds) {
			this.revoke(id, revoker);
		}
		return Promise.resolve();
	}

	public revokeAllOf(userIds: readonly string[], revoker: SessionRevoker, _now: EpochMs, keepSessionId: string | null): Promise<void> {
		for (const row of [...this.rows.values()]) {
			if (userIds.includes(row.userId) && row.id !== keepSessionId) {
				this.revoke(row.id, revoker);
			}
		}
		return Promise.resolve();
	}

	public revokeOwn(sessionId: string, userId: string, revoker: SessionRevoker): Promise<OwnSessionRevocation> {
		const row = this.rows.get(sessionId);
		if (row?.userId !== userId) {
			return Promise.resolve("not_found");
		}
		if (row.isDeleted) {
			return Promise.resolve("already_revoked");
		}
		this.revoke(sessionId, revoker);
		return Promise.resolve("revoked");
	}

	/** Who revoked a session (`null` while it is live). */
	public revokerOf(sessionId: string): string | null {
		return this.rows.get(sessionId)?.deletedBy ?? null;
	}

	private revoke(id: string, revoker: SessionRevoker): void {
		const row = this.rows.get(id);
		if (row !== undefined && !row.isDeleted) {
			this.rows.set(id, { ...row, isDeleted: true, deletedBy: sessionRevokerColumn(revoker) });
		}
	}
}

export class InMemoryImpersonations implements ImpersonationSessionRepository {
	public readonly rows = new Map<string, ImpersonationSessionState>();
	public readonly audits: string[] = [];

	public findById(id: string): Promise<ImpersonationSession | null> {
		const row: ImpersonationSessionState | undefined = this.rows.get(id);
		return Promise.resolve(row === undefined ? null : ImpersonationSession.rehydrate(row));
	}

	public hasLiveSessionFor(impersonatorId: string, now: EpochMs): Promise<boolean> {
		return Promise.resolve(
			[...this.rows.values()].some((row: ImpersonationSessionState): boolean => row.impersonatorId === impersonatorId && row.endedAt === null && row.expiresAt > now),
		);
	}

	public add(session: ImpersonationSession): Promise<void> {
		this.rows.set(session.id, session.snapshot);
		this.audits.push(...session.pendingAudits.map((audit): string => audit.action));
		return Promise.resolve();
	}

	public saveEnded(session: ImpersonationSession): Promise<void> {
		this.rows.set(session.id, session.snapshot);
		this.audits.push(...session.pendingAudits.map((audit): string => audit.action));
		return Promise.resolve();
	}
}

export class InMemoryMfaRecoveries implements MfaRecoveryRequestRepository {
	public readonly rows = new Map<string, MfaRecoveryRequestState>();
	public readonly audits: string[] = [];
	public openingLocks = 0;

	public lockOpeningFor(): Promise<void> {
		this.openingLocks += 1;
		return Promise.resolve();
	}

	public hasOpenRequest(userId: string): Promise<boolean> {
		return Promise.resolve(
			[...this.rows.values()].some((row: MfaRecoveryRequestState): boolean => row.userId === userId && (row.status === "PENDING" || row.status === "APPROVED")),
		);
	}

	public findById(id: string): Promise<MfaRecoveryRequest | null> {
		const row: MfaRecoveryRequestState | undefined = this.rows.get(id);
		return Promise.resolve(row === undefined ? null : MfaRecoveryRequest.rehydrate(row));
	}

	public findDueApprovedIds(now: EpochMs): Promise<readonly string[]> {
		return Promise.resolve(
			[...this.rows.values()]
				.filter((row: MfaRecoveryRequestState): boolean => row.status === "APPROVED" && row.scheduledUnlockAt !== null && row.scheduledUnlockAt <= now)
				.map((row: MfaRecoveryRequestState): string => row.id),
		);
	}

	public add(request: MfaRecoveryRequest): Promise<void> {
		this.rows.set(request.id, request.snapshot);
		this.audits.push(...request.pendingAudits.map((audit): string => audit.action));
		return Promise.resolve();
	}

	/**
	 * Compare-and-set on the status the request was loaded with, as the Prisma repository does: a lost
	 * review throws `MfaRecoveryNotPendingError`, a lost completion answers `false`.
	 */
	public save(request: MfaRecoveryRequest): Promise<boolean> {
		const stored: MfaRecoveryRequestState | undefined = this.rows.get(request.id);
		if (stored?.status !== request.concurrencyToken) {
			return request.concurrencyToken === "PENDING" ? Promise.reject(new MfaRecoveryNotPendingError()) : Promise.resolve(false);
		}
		this.rows.set(request.id, request.snapshot);
		this.audits.push(...request.pendingAudits.map((audit): string => audit.action));
		return Promise.resolve(true);
	}
}

export class InMemoryResetTokens implements PasswordResetTokenRepository {
	public readonly rows = new Map<string, PasswordResetTokenState>();

	public findUsableByDigest(tokenDigest: string, now: EpochMs): Promise<PasswordResetToken | null> {
		const row: PasswordResetTokenState | undefined = [...this.rows.values()].find(
			(candidate: PasswordResetTokenState): boolean => candidate.tokenDigest === tokenDigest && candidate.usedAt === null && candidate.expiresAt >= now,
		);
		return Promise.resolve(row === undefined ? null : PasswordResetToken.rehydrate(row));
	}

	public expireOpenTokensOf(userId: string, now: EpochMs): Promise<void> {
		for (const row of [...this.rows.values()]) {
			if (row.userId === userId && row.usedAt === null) {
				this.rows.set(row.id, { ...row, expiresAt: epochMs(now - 1) });
			}
		}
		return Promise.resolve();
	}

	public add(token: PasswordResetToken): Promise<void> {
		this.rows.set(token.id, token.snapshot);
		return Promise.resolve();
	}

	public saveConsumed(token: PasswordResetToken): Promise<void> {
		this.rows.set(token.id, token.snapshot);
		return Promise.resolve();
	}

	public retireStale(now: EpochMs, usedRetentionMs: number, expiredGraceMs: number): Promise<number> {
		let retired = 0;
		for (const row of [...this.rows.values()]) {
			const usedLongAgo: boolean = row.usedAt !== null && row.usedAt < now - usedRetentionMs;
			const expiredLongAgo: boolean = row.expiresAt < now - expiredGraceMs;
			if (usedLongAgo || expiredLongAgo) {
				this.rows.delete(row.id);
				retired += 1;
			}
		}
		return Promise.resolve(retired);
	}
}

/** Enrollments kept as live aggregates (their writes are `pendingChanges`, recorded on save). */
export class InMemoryTwoFactor implements TwoFactorEnrollmentRepository {
	public readonly enrollments = new Map<string, TwoFactorEnrollment>();
	public readonly saved: TwoFactorEnrollment[] = [];

	public findByUserId(userId: string): Promise<TwoFactorEnrollment | null> {
		return Promise.resolve(this.enrollments.get(userId) ?? null);
	}

	public save(enrollment: TwoFactorEnrollment): Promise<void> {
		this.enrollments.set(enrollment.userId, enrollment);
		this.saved.push(enrollment);
		return Promise.resolve();
	}
}

export class InMemoryChallenges implements TwoFactorLoginChallengeRepository {
	public readonly rows = new Map<string, TwoFactorLoginChallengeState>();

	public findById(id: string): Promise<TwoFactorLoginChallenge | null> {
		const row: TwoFactorLoginChallengeState | undefined = this.rows.get(id);
		return Promise.resolve(row === undefined ? null : TwoFactorLoginChallenge.rehydrate(row));
	}

	public add(challenge: TwoFactorLoginChallenge): Promise<void> {
		this.rows.set(challenge.id, challenge.snapshot);
		return Promise.resolve();
	}

	public saveConsumed(challenge: TwoFactorLoginChallenge): Promise<void> {
		this.rows.set(challenge.id, challenge.snapshot);
		return Promise.resolve();
	}

	public recordFailedAttempt(challengeId: string): Promise<FailedChallengeAttempt> {
		const row: TwoFactorLoginChallengeState | undefined = this.rows.get(challengeId);
		if (row === undefined) {
			return Promise.resolve(null);
		}
		if (row.consumedAt !== null) {
			return Promise.resolve(null);
		}
		const attemptCount: number = row.attemptCount + 1;
		this.rows.set(challengeId, { ...row, attemptCount });
		return Promise.resolve({ attemptCount });
	}
}

export class InMemoryProfiles implements UserProfileRepository {
	public readonly profiles = new Map<string, UserProfile>();
	public readonly reads = new Map<string, OwnProfile>();
	public readonly saved: UserProfile[] = [];

	public findLive(userId: string): Promise<UserProfile | null> {
		return Promise.resolve(this.profiles.get(userId) ?? null);
	}

	public readOwnProfile(userId: string): Promise<OwnProfile | null> {
		return Promise.resolve(this.reads.get(userId) ?? null);
	}

	public save(profile: UserProfile): Promise<void> {
		this.saved.push(profile);
		return Promise.resolve();
	}
}

/** Every email identity asked for, by kind and recipient. */
export class RecordingIdentityEmails implements IdentityEmailPort {
	public readonly sent: { readonly kind: string; readonly to: string; readonly detail: string | null }[] = [];

	public sendVerificationEmail(email: string, verificationToken: string): Promise<void> {
		return this.record("verification", email, verificationToken);
	}

	public sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
		return this.record("password_reset", email, resetToken);
	}

	public sendAccountLockedEmail(email: string): Promise<void> {
		return this.record("account_locked", email, null);
	}

	public sendPasswordChangedEmail(email: string): Promise<void> {
		return this.record("password_changed", email, null);
	}

	public sendTwoFactorEnabledEmail(email: string): Promise<void> {
		return this.record("two_factor_enabled", email, null);
	}

	public sendTwoFactorDisabledEmail(email: string): Promise<void> {
		return this.record("two_factor_disabled", email, null);
	}

	public async sendLoginVerificationEmail(email: string, verificationCode: string): Promise<EmailSendResult> {
		await this.record("login_verification", email, verificationCode);
		return { ok: true, id: `email-${String(this.sent.length)}`, mode: "queued" };
	}

	public sendMfaRecoveryUserNotification(email: string, title: string): Promise<void> {
		return this.record("mfa_recovery_user", email, title);
	}

	public sendMfaRecoveryAdminNotification(email: string, title: string): Promise<void> {
		return this.record("mfa_recovery_admin", email, title);
	}

	public kinds(): readonly string[] {
		return this.sent.map((email): string => email.kind);
	}

	private record(kind: string, to: string, detail: string | null): Promise<void> {
		this.sent.push({ kind, to, detail });
		return Promise.resolve();
	}
}

export class RecordingRequestAudit implements RequestAuditPort {
	public readonly bodies: JsonValue[] = [];

	public recordSuccess(responseBody: JsonValue): Promise<void> {
		this.bodies.push(responseBody);
		return Promise.resolve();
	}
}

export class RecordingRoleAssignments implements DefaultRoleAssignmentPort {
	public readonly consumers: string[] = [];
	public readonly provisioned: PlatformRoleAssignmentRequest[] = [];
	/** Role names the platform catalog lacks (reference data never loaded). */
	public readonly missingRoles = new Set<string>();

	public assignDefaultRole(userId: string): Promise<void> {
		this.consumers.push(userId);
		return Promise.resolve();
	}

	public assignPlatformRole(request: PlatformRoleAssignmentRequest): Promise<PlatformRoleAssignmentOutcome> {
		if (this.missingRoles.has(request.roleName)) {
			return Promise.resolve({ kind: "role_missing" });
		}
		this.provisioned.push(request);
		return Promise.resolve({ kind: "assigned", roleId: `role-${request.roleName}` });
	}

	public findPlatformRoleId(roleName: string): Promise<string | null> {
		return Promise.resolve(this.missingRoles.has(roleName) ? null : `role-${roleName}`);
	}
}

export class RecordingSignupReferrals implements TransactionalSignupReferralPort {
	public readonly firstCodes: string[] = [];
	public readonly attached: { readonly accepted: AcceptedSignupReferral; readonly refereeId: string }[] = [];

	public issueFirstCode(userId: string): Promise<void> {
		this.firstCodes.push(userId);
		return Promise.resolve();
	}

	public attachSignupReferral(accepted: AcceptedSignupReferral, referee: { readonly id: string; readonly createdAt: number }): Promise<void> {
		this.attached.push({ accepted, refereeId: referee.id });
		return Promise.resolve();
	}
}

function restorableMap<Key, Value>(map: Map<Key, Value>): () => void {
	const saved: [Key, Value][] = [...map.entries()];
	return (): void => {
		map.clear();
		for (const [key, value] of saved) {
			map.set(key, value);
		}
	};
}

/** Restores an append-only record to its current length (any array: only `length` is touched). */
function restorableArray(items: { length: number }): () => void {
	const length: number = items.length;
	return (): void => {
		items.length = length;
	};
}

/** A unit of work over {@link InMemoryIdentityStore} that rolls the store back when the work throws, as Postgres does. */
export class InMemoryIdentityUnitOfWork implements UnitOfWork<IdentityScope> {
	public readonly committed: { readonly actor: ActorContext; readonly operation: SystemOperationName | null }[] = [];
	public readonly rolledBack: ActorContext[] = [];

	public constructor(private readonly store: InMemoryIdentityStore) {}

	public run<TResult>(actor: ActorContext, work: (scope: IdentityScope) => Promise<TResult>): Promise<TResult> {
		return this.execute(actor, null, work);
	}

	public runSystemOperation<TResult>(operation: SystemOperationName, actor: ActorContext, work: (scope: IdentityScope) => Promise<TResult>): Promise<TResult> {
		return this.execute(actor, operation, work);
	}

	private async execute<TResult>(actor: ActorContext, operation: SystemOperationName | null, work: (scope: IdentityScope) => Promise<TResult>): Promise<TResult> {
		const rollback: () => void = this.store.checkpoint();
		try {
			const result: TResult = await work(this.store.scope);
			this.committed.push({ actor, operation });
			return result;
		} catch (error) {
			rollback();
			this.rolledBack.push(actor);
			throw error;
		}
	}
}

/** One identity transaction's worth of in-memory stores, shared across `run` calls like one database. */
export class InMemoryIdentityStore {
	public readonly accounts = new InMemoryUserAccounts();
	public readonly sessions = new InMemoryDeviceSessions();
	public readonly impersonations = new InMemoryImpersonations();
	public readonly mfaRecoveries = new InMemoryMfaRecoveries();
	public readonly resetTokens = new InMemoryResetTokens();
	public readonly twoFactor = new InMemoryTwoFactor();
	public readonly challenges = new InMemoryChallenges();
	public readonly profiles = new InMemoryProfiles();
	public readonly emails = new RecordingIdentityEmails();
	public readonly requestAudit = new RecordingRequestAudit();
	public readonly roles = new RecordingRoleAssignments();
	public readonly signupReferrals = new RecordingSignupReferrals();
	public readonly events = new TransactionalEventCollector();
	public readonly scope: IdentityScope = {
		accounts: this.accounts,
		sessions: this.sessions,
		impersonations: this.impersonations,
		mfaRecoveries: this.mfaRecoveries,
		resetTokens: this.resetTokens,
		twoFactor: this.twoFactor,
		challenges: this.challenges,
		profiles: this.profiles,
		emails: this.emails,
		requestAudit: this.requestAudit,
		roles: this.roles,
		signupReferrals: this.signupReferrals,
		events: this.events,
	};
	public readonly uow = new InMemoryIdentityUnitOfWork(this);

	/**
	 * Snapshots every stored row and recorded write; the returned function puts them back (a
	 * rollback). Two-factor enrollments and profiles are live aggregates and are not restored.
	 */
	public checkpoint(): () => void {
		const restorers: (() => void)[] = [
			restorableMap(this.accounts.rows),
			restorableMap(this.sessions.rows),
			restorableMap(this.impersonations.rows),
			restorableMap(this.mfaRecoveries.rows),
			restorableMap(this.resetTokens.rows),
			restorableMap(this.challenges.rows),
			restorableArray(this.impersonations.audits),
			restorableArray(this.mfaRecoveries.audits),
			restorableArray(this.emails.sent),
			restorableArray(this.requestAudit.bodies),
			restorableArray(this.roles.consumers),
			restorableArray(this.roles.provisioned),
			restorableArray(this.signupReferrals.firstCodes),
			restorableArray(this.signupReferrals.attached),
		];
		const pendingEvents = this.events.pendingCount();
		return (): void => {
			for (const restore of restorers) {
				restore();
			}
			const collected = this.events.take();
			for (const event of collected.slice(0, pendingEvents)) {
				this.events.collect(event);
			}
		};
	}

	/** Names of the events collected so far, in order. */
	public eventNames(): readonly string[] {
		return this.events.take().map((event): string => event.eventName);
	}
}

/**
 * Deterministic crypto: a hash is `hash:<data>`, a refresh digest `digest:<token>` (a stored value
 * without the prefix is a pre-digest row), and random values count up.
 */
export class FakeCredentialCrypto implements CredentialCryptoPort {
	private counter = 0;

	public hash(data: string): Promise<string> {
		return Promise.resolve(`hash:${data}`);
	}

	public compare(data: string, hash: string): Promise<boolean> {
		return Promise.resolve(hash === `hash:${data}`);
	}

	public generateRandomToken(): string {
		this.counter += 1;
		return `random-${String(this.counter)}`;
	}

	public hashTokenDigest(rawToken: string): string {
		return `sha:${rawToken}`;
	}

	public hashRefreshToken(refreshToken: string): string {
		return `digest:${refreshToken}`;
	}

	public matchesRefreshToken(refreshToken: string, storedDigest: string): boolean {
		return storedDigest === `digest:${refreshToken}`;
	}

	public isRefreshTokenDigest(storedHash: string): boolean {
		return storedHash.startsWith("digest:");
	}

	public generateNumericCode(length: number): string {
		return "7".repeat(length);
	}
}

/** Tokens as readable strings; verification of refresh tokens and challenge refs is scripted per test. */
export class FakeIdentityTokens implements IdentityTokensPort {
	public readonly refreshTokens = new Map<string, RefreshTokenPayload>();
	public readonly challengeRefs = new Map<string, VerifiedChallengeRef>();
	public readonly accessTokensIssued: { readonly userId: string; readonly sessionId: string }[] = [];
	private rotation = 0;

	public generateSessionTokens(user: FlatUserResponse, sessionId: string, options: SessionTokenOptions): Promise<SessionTokens> {
		this.rotation += 1;
		return Promise.resolve({
			accessToken: `access:${user.id}:${sessionId}:${options.sessionScope}`,
			refreshToken: `refresh:${sessionId}:${String(this.rotation)}`,
		});
	}

	public generateAccessToken(user: FlatUserResponse, sessionId: string): Promise<string> {
		this.accessTokensIssued.push({ userId: user.id, sessionId });
		return Promise.resolve(`access:${user.id}:${sessionId}`);
	}

	public generateImpersonationToken(user: FlatUserResponse, originalUserId: string, impersonationSessionId: string): Promise<string> {
		return Promise.resolve(`impersonation:${user.id}:${originalUserId}:${impersonationSessionId}`);
	}

	public generateEmailVerificationToken(email: string): Promise<string> {
		return Promise.resolve(`verify:${email}`);
	}

	public verifyEmailToken(token: string): Promise<string> {
		return Promise.resolve(token.replace("verify:", ""));
	}

	public signChallengeRef(): Promise<string> {
		return Promise.resolve("challenge-ref");
	}

	public verifyChallengeRef(token: string): Promise<VerifiedChallengeRef> {
		const ref: VerifiedChallengeRef | undefined = this.challengeRefs.get(token);
		return ref === undefined ? Promise.reject(new Error(`unknown challenge ref ${token}`)) : Promise.resolve(ref);
	}

	public verifyAccessToken(): Promise<AccessTokenPayload> {
		return Promise.reject(new Error("verifyAccessToken is not scripted in this test"));
	}

	public verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
		const payload: RefreshTokenPayload | undefined = this.refreshTokens.get(token);
		return payload === undefined ? Promise.reject(new Error(`unknown refresh token ${token}`)) : Promise.resolve(payload);
	}
}

/** Every user holds the same plain permission set. */
export class FixedGrants implements UserGrantsReadPort {
	/** Live roles per user, for the admin user list. */
	public readonly rolesByUser = new Map<string, readonly SlimRole[]>();

	public constructor(private readonly permissions: UserPermissions = { roles: [], permissions: [] }) {}

	public getUserPermissionDetails(): Promise<UserPermissions> {
		return Promise.resolve(this.permissions);
	}

	public getUserCapabilitySlugs(): Promise<readonly CapabilitySlug[]> {
		return Promise.resolve([]);
	}

	public getUserDirectPermissionIds(): Promise<readonly string[]> {
		return Promise.resolve([]);
	}

	public listRolesOfUsers(userIds: readonly string[]): Promise<ReadonlyMap<string, readonly SlimRole[]>> {
		return Promise.resolve(
			new Map(
				userIds.flatMap((userId: string): [string, readonly SlimRole[]][] => {
					const roles: readonly SlimRole[] | undefined = this.rolesByUser.get(userId);
					return roles === undefined ? [] : [[userId, roles]];
				}),
			),
		);
	}
}

export class RecordingTelemetry implements IdentityTelemetryPort {
	public readonly actions: SessionActionTelemetry[] = [];

	public recordSessionAction(event: SessionActionTelemetry): Promise<void> {
		this.actions.push(event);
		return Promise.resolve();
	}
}

export const TEST_SETTINGS: IdentitySettings = {
	mfaEnrollmentGraceMs: 7 * 24 * HOUR_MS,
	mfaRecoveryDelayMs: 24 * HOUR_MS,
	mfaStepUpTtlMs: 5 * 60_000,
	loginVerificationMode: "disabled",
	sessionLifetimeMs: 30 * 24 * HOUR_MS,
	twoFactorIssuer: "Starter Kit",
};

const REQUEST = { requestId: "req-1", ip: "198.51.100.7", userAgent: "Firefox", deviceLabel: null, endpoint: null };

export function userActor(userId: string, overrides: { readonly isSuperAdmin?: boolean; readonly impersonatorUserId?: string | null } = {}): ActorContext {
	return {
		kind: "user",
		userId,
		sessionId: "session-1",
		organizationId: null,
		isSuperAdmin: overrides.isSuperAdmin ?? false,
		accessScope: overrides.isSuperAdmin === true ? "superadmin" : "tenant",
		impersonatorUserId: overrides.impersonatorUserId ?? null,
		request: REQUEST,
	};
}

export function anonymousActor(): ActorContext {
	return { kind: "anonymous", organizationId: null, request: REQUEST };
}

/** A stored, verified, active account without 2FA. */
export function accountState(overrides: Partial<UserAccountState> & Pick<UserAccountState, "id" | "email">): UserAccountState {
	return {
		fullName: "Jane Doe",
		passwordHash: "hash:Correct-Horse-1",
		isActive: true,
		isSuperAdmin: false,
		isDeleted: false,
		deletedAt: null,
		emailVerifiedAt: NOW,
		tokenVersion: TokenVersion.of(1),
		lockout: LockoutState.clear(),
		twoFactorEnabled: false,
		mfaEnrollmentDeadline: null,
		mfaAssuredAt: null,
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	};
}

/** A desktop Firefox browser on the web app. */
export const TEST_DEVICE: SessionDeviceDetails = {
	clientType: "web",
	browserName: "Firefox",
	browserVersion: "130",
	osName: "macOS",
	osVersion: "15",
	deviceType: "DESKTOP",
	deviceModel: null,
	deviceName: null,
	appVersion: null,
};

/** A refresh token's verified claims for one device session. */
export function refreshClaims(userId: string, email: string, sessionId: string): RefreshTokenPayload {
	return { sub: userId, email, jti: sessionId, tokenType: "refresh", iat: Math.floor(NOW / MS_PER_SECOND), exp: Math.floor((NOW + HOUR_MS) / MS_PER_SECOND) };
}

/** A stored live device session whose current refresh token is `refresh:<id>:0`. */
export function sessionState(overrides: Partial<DeviceSessionState> & Pick<DeviceSessionState, "id" | "userId">): DeviceSessionState {
	return {
		tokenHash: `digest:refresh:${overrides.id}:0`,
		previousTokenHash: null,
		device: TEST_DEVICE,
		signInMethod: "PASSWORD",
		ipAddress: REQUEST.ip,
		lastIpAddress: REQUEST.ip,
		location: null,
		createdAt: NOW,
		lastActiveAt: NOW,
		expiresAt: epochMs(NOW + HOUR_MS),
		isDeleted: false,
		updatedAt: NOW,
		...overrides,
	};
}

/** Ids `<prefix>-1`, `<prefix>-2`, … in call order. */
export class SequentialIds implements IdGeneratorPort {
	private counter = 0;

	public constructor(private readonly prefix = "id") {}

	public next(): string {
		this.counter += 1;
		return `${this.prefix}-${String(this.counter)}`;
	}
}

/** The users the tracked auth flows were attributed to, in order. */
export class RecordingFlowSubject implements AuthFlowSubjectPort {
	public readonly identified: string[] = [];

	public identify(userId: string): void {
		this.identified.push(userId);
	}
}

/** The only code the fake authenticator accepts, and the time step it reports for it. */
export const VALID_TOTP_CODE = "123456";
export const VALID_TOTP_STEP = 42;

/** TOTP without time: `VALID_TOTP_CODE` is valid unless its step was already used (replay, D13). */
export class FakeAuthenticator implements AuthenticatorPort {
	public generateSecret(): string {
		return "JBSWY3DPEHPK3PXP";
	}

	public keyUri(input: { readonly issuer: string; readonly label: string; readonly secret: string }): string {
		return `otpauth://totp/${input.issuer}:${input.label}?secret=${input.secret}`;
	}

	public verify(token: string, _secret: string, afterTimeStep: number | null): TotpVerification {
		const replayed: boolean = afterTimeStep !== null && afterTimeStep >= VALID_TOTP_STEP;
		return token === VALID_TOTP_CODE && !replayed ? { valid: true, timeStep: VALID_TOTP_STEP } : { valid: false };
	}

	public generateBackupCodes(): string[] {
		return ["BACKUP-ONE", "BACKUP-TWO"];
	}
}

/** "Encrypts" by tagging the plaintext with its context, so a context mix-up fails like AES-GCM's AAD does. */
export class FakeTotpCipher implements TotpSecretCipherPort {
	public encrypt(plaintext: string, context: TotpSecretEncryptionContext): EncryptedTotpSecret {
		return { ciphertext: `${context}|${plaintext}`, iv: "iv", keyVersion: 1 };
	}

	public decrypt(secret: EncryptedTotpSecret, context: TotpSecretEncryptionContext): string {
		const prefix = `${context}|`;
		if (!secret.ciphertext.startsWith(prefix)) {
			throw new Error(`decryption failed: ${context} expected`);
		}
		return secret.ciphertext.slice(prefix.length);
	}
}

/** Signup referral codes as scripted per test: `null` when none was submitted, the scripted answer otherwise. */
export class ScriptedSignupReferralCodes implements SignupReferralPort {
	public readonly accepted = new Map<string, AcceptedSignupReferral>();
	public readonly summaries = new Map<string, SignupReferralSummary>();

	public acceptCodeForSignup(raw: string | null | undefined): Promise<AcceptedSignupReferral | null> {
		if (raw === null || raw === undefined) {
			return Promise.resolve(null);
		}
		const accepted: AcceptedSignupReferral | undefined = this.accepted.get(raw);
		return accepted === undefined ? Promise.reject(new Error(`referral code ${raw} is invalid`)) : Promise.resolve(accepted);
	}

	public summariesForReferees(refereeUserIds: readonly string[]): Promise<ReadonlyMap<string, SignupReferralSummary>> {
		return Promise.resolve(new Map([...this.summaries].filter(([refereeId]): boolean => refereeUserIds.includes(refereeId))));
	}

	public summaryForReferee(refereeUserId: string): Promise<SignupReferralSummary | null> {
		return Promise.resolve(this.summaries.get(refereeUserId) ?? null);
	}
}
