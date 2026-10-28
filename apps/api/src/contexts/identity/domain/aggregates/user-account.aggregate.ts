import type { EpochMs } from "@workspace/shared";

import { AggregateRoot } from "../../../../platform/domain/aggregate-root";
import {
	AccountAlreadyBannedError,
	AccountNotBannedError,
	CannotBanSelfError,
	CannotBanSuperAdminError,
	CredentialAccountMissingError,
	CurrentPasswordIncorrectError,
	InvalidOnboardingPasswordError,
} from "../errors/identity.errors";
import { UserCredentialsChanged, UserProfileChanged, type IdentityEvent } from "../events/identity.events";
import { EmailAddress } from "../value-objects/email-address.value-object";
import { LockoutState } from "../value-objects/lockout-state.value-object";
import { PasswordPolicy } from "../value-objects/password-policy.value-object";
import { TokenVersion } from "../value-objects/token-version.value-object";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

/** A platform ban: who banned the account, when, and why. */
export interface AccountBan {
	readonly bannedAt: EpochMs;
	/** null when the banning admin's account no longer exists. */
	readonly bannedByUserId: string | null;
	readonly reason: string;
}

/** Everything the account row holds that identity's rules read. Mappers build it; nothing else does. */
export interface UserAccountState {
	readonly id: string;
	readonly email: EmailAddress;
	readonly fullName: string;
	readonly passwordHash: string;
	readonly isActive: boolean;
	readonly isSuperAdmin: boolean;
	/** A load-test user (ADR 068): only inside the Load Test tenant; never sent a new-device code. */
	readonly isLoadTestUser: boolean;
	readonly isDeleted: boolean;
	readonly deletedAt: EpochMs | null;
	readonly emailVerifiedAt: EpochMs | null;
	readonly tokenVersion: TokenVersion;
	readonly lockout: LockoutState;
	readonly twoFactorEnabled: boolean;
	readonly mfaEnrollmentDeadline: EpochMs | null;
	readonly mfaAssuredAt: EpochMs | null;
	readonly ban: AccountBan | null;
	readonly createdAt: EpochMs;
	readonly updatedAt: EpochMs;
}

/** A brand-new account, before it is stored. */
export interface NewUserAccount {
	readonly id: string;
	readonly email: EmailAddress;
	readonly fullName: string;
	readonly passwordHash: string;
	readonly isSuperAdmin: boolean;
	/** Already verified (bootstrap, invite registration with a proven email), or `null`. */
	readonly emailVerifiedAt: EpochMs | null;
	/** When the account must have enrolled MFA by (signup grace period; `now` for a platform operator), or `null`. */
	readonly mfaEnrollmentDeadline: EpochMs | null;
}

/** The outcome of the password step of a sign-in. */
export type PasswordSignInDecision = "locked" | "rejected" | "accepted";

/** What one unit of work changed on the account, in order; the repository applies each as a conditional write. */
export type UserAccountChange =
	/** New hash + token generation; compare-and-set on `previousTokenVersion` (D35), plus a password-history row. */
	| { readonly kind: "password_replaced"; readonly passwordHash: string; readonly previousTokenVersion: TokenVersion; readonly at: EpochMs }
	/** Compare-and-set on `email_verified_at IS NULL`; a lost race is reported as `EmailAlreadyVerifiedError`. */
	| { readonly kind: "email_verified"; readonly at: EpochMs }
	| { readonly kind: "lockout_cleared"; readonly at: EpochMs }
	| { readonly kind: "mfa_assured"; readonly at: EpochMs }
	/** A provisioning flow refreshed the name; the profile's optimistic-lock token moves too. */
	| { readonly kind: "renamed"; readonly fullName: string; readonly at: EpochMs }
	/** Deactivates the account with the ban; compare-and-set on `previousTokenVersion` and on not being banned. */
	| { readonly kind: "banned"; readonly ban: AccountBan; readonly previousTokenVersion: TokenVersion }
	/** Re-activates the account; compare-and-set on the ban being the one that was loaded. */
	| { readonly kind: "unbanned"; readonly bannedAt: EpochMs; readonly at: EpochMs };

/**
 * The account aggregate: credentials, lockout, email verification and the token generation.
 *
 * Concurrency: credential changes (password change and reset) are compare-and-set on the
 * `tokenVersion` the account was loaded with ({@link UserAccount.concurrencyToken}, D35). Lockout
 * counting is an atomic database statement (D19), never a read-modify-write of this object.
 */
export class UserAccount extends AggregateRoot<IdentityEvent> {
	private readonly changes: UserAccountChange[] = [];

	private constructor(
		private state: UserAccountState,
		private readonly loadedTokenVersion: TokenVersion,
		public readonly isNew: boolean,
	) {
		super();
	}

	/** A new account as signup, invite registration or the bootstrap creates it. */
	public static register(input: NewUserAccount, now: EpochMs): UserAccount {
		if (input.fullName.trim().length === 0) {
			throw new CorruptAggregateStateError("user_account", null, "full name is empty");
		}
		const state: UserAccountState = {
			id: input.id,
			email: input.email,
			fullName: input.fullName,
			passwordHash: input.passwordHash,
			isActive: true,
			isSuperAdmin: input.isSuperAdmin,
			isLoadTestUser: false,
			isDeleted: false,
			deletedAt: null,
			emailVerifiedAt: input.emailVerifiedAt,
			tokenVersion: TokenVersion.of(0),
			lockout: LockoutState.clear(),
			twoFactorEnabled: false,
			mfaEnrollmentDeadline: input.mfaEnrollmentDeadline,
			mfaAssuredAt: null,
			ban: null,
			createdAt: now,
			updatedAt: now,
		};
		return new UserAccount(state, state.tokenVersion, true);
	}

	/** Mapper-only: an account read back from storage. Refuses state that breaks an invariant. */
	public static rehydrate(state: UserAccountState): UserAccount {
		if (state.passwordHash.length === 0) {
			throw new CorruptAggregateStateError("user_account", null, `account ${state.id} has no password hash`);
		}
		if (state.ban !== null && state.isActive) {
			throw new CorruptAggregateStateError("user_account", null, `account ${state.id} is banned but active`);
		}
		return new UserAccount(state, state.tokenVersion, false);
	}

	public get id(): string {
		return this.state.id;
	}

	public get email(): EmailAddress {
		return this.state.email;
	}

	public get fullName(): string {
		return this.state.fullName;
	}

	public get passwordHash(): string {
		return this.state.passwordHash;
	}

	public get isActive(): boolean {
		return this.state.isActive;
	}

	public get isSuperAdmin(): boolean {
		return this.state.isSuperAdmin;
	}

	/** A load-test user signs in without the new-device code: its address cannot receive one (ADR 068). */
	public get isLoadTestUser(): boolean {
		return this.state.isLoadTestUser;
	}

	public get isDeleted(): boolean {
		return this.state.isDeleted;
	}

	public get tokenVersion(): TokenVersion {
		return this.state.tokenVersion;
	}

	public get lockout(): LockoutState {
		return this.state.lockout;
	}

	public get twoFactorEnabled(): boolean {
		return this.state.twoFactorEnabled;
	}

	public get ban(): AccountBan | null {
		return this.state.ban;
	}

	public get snapshot(): UserAccountState {
		return this.state;
	}

	/** The `tokenVersion` this account was loaded with: credential writes compare-and-set on it (D35). */
	public get concurrencyToken(): TokenVersion {
		return this.loadedTokenVersion;
	}

	/** The writes this unit of work made, for the repository. */
	public get pendingChanges(): readonly UserAccountChange[] {
		return this.changes;
	}

	/** May this account receive a session at all (any sign-in method)? */
	public canSignIn(): boolean {
		return this.state.isActive && !this.state.isDeleted;
	}

	/** An active account whose address is not verified yet: a (re)sent verification link is due. */
	public awaitsEmailVerification(): boolean {
		return this.state.isActive && this.state.emailVerifiedAt === null;
	}

	/** May a password reset link be sent to this account? */
	public canResetPassword(): boolean {
		return this.canSignIn();
	}

	/** Verified once `emailVerifiedAt` is set and not in the future. */
	public isEmailVerifiedAt(now: EpochMs): boolean {
		return this.state.emailVerifiedAt !== null && this.state.emailVerifiedAt <= now;
	}

	/** The MFA proof time a session issued now carries (`mfaAssuredAt` when it is not in the future). */
	public mfaAssuranceAt(now: EpochMs): EpochMs | null {
		return this.state.mfaAssuredAt !== null && this.state.mfaAssuredAt <= now ? this.state.mfaAssuredAt : null;
	}

	public get mfaEnrollmentDeadline(): EpochMs | null {
		return this.state.mfaEnrollmentDeadline;
	}

	/**
	 * The password step of a sign-in, after the password was compared. A locked account is refused
	 * without counting the attempt; an inactive or deleted account, or a wrong password, is refused
	 * and counted. All refusals look the same to the caller (`INVALID_CREDENTIALS`).
	 */
	public evaluatePasswordSignIn(passwordMatches: boolean, now: EpochMs): PasswordSignInDecision {
		if (this.state.lockout.isLockedAt(now)) {
			return "locked";
		}
		if (!this.canSignIn() || !passwordMatches) {
			return "rejected";
		}
		return "accepted";
	}

	/** Change-password's first check: the caller proved the current password. */
	public assertCurrentPassword(currentPasswordMatches: boolean): void {
		if (!this.canSignIn()) {
			throw new CredentialAccountMissingError();
		}
		if (!currentPasswordMatches) {
			throw new CurrentPasswordIncorrectError();
		}
	}

	/** The signed-in user replaces their password. Bumps `tokenVersion` (every other token stops working). */
	public changePassword(newPasswordHash: string, matchedRecentPassword: boolean, now: EpochMs): void {
		this.replacePassword(newPasswordHash, matchedRecentPassword, now, "password_changed");
	}

	/** A verified reset link replaces the password. Bumps `tokenVersion`. */
	public resetPassword(newPasswordHash: string, matchedRecentPassword: boolean, now: EpochMs): void {
		this.replacePassword(newPasswordHash, matchedRecentPassword, now, "password_reset");
	}

	/**
	 * Marks the address verified. Returns `false` (and changes nothing) when it already was — the
	 * repository also writes it conditionally, so two concurrent verifications cannot both win (the
	 * loser gets `EmailAlreadyVerifiedError` from the repository and answers "already verified").
	 */
	public verifyEmail(now: EpochMs): boolean {
		if (this.state.emailVerifiedAt !== null) {
			return false;
		}
		this.state = { ...this.state, emailVerifiedAt: now, updatedAt: now };
		this.changes.push({ kind: "email_verified", at: now });
		this.record(new UserProfileChanged(this.state.id, now));
		return true;
	}

	/**
	 * An administrator clears the lockout (D18): the counter and any lock. Recorded as a credential
	 * change so the cached account state is dropped on every instance.
	 */
	public unlock(now: EpochMs): void {
		this.state = { ...this.state, lockout: LockoutState.clear(), updatedAt: now };
		this.changes.push({ kind: "lockout_cleared", at: now });
		this.record(new UserCredentialsChanged(this.state.id, "account_unlocked", now));
	}

	/**
	 * A platform admin bans the account: it is deactivated (no sign-in, no refresh) and its
	 * `tokenVersion` moves, so every access token it holds stops working. An admin cannot ban
	 * themselves or a SuperAdmin, and a banned account cannot be banned again.
	 */
	public banBy(adminUserId: string, reason: string, now: EpochMs): void {
		if (adminUserId === this.state.id) {
			throw new CannotBanSelfError();
		}
		if (this.state.isSuperAdmin) {
			throw new CannotBanSuperAdminError();
		}
		if (this.state.ban !== null) {
			throw new AccountAlreadyBannedError();
		}
		const trimmed = reason.trim();
		if (trimmed.length === 0) {
			throw new CorruptAggregateStateError("user_account", null, "the ban reason is empty");
		}
		const ban: AccountBan = { bannedAt: now, bannedByUserId: adminUserId, reason: trimmed };
		this.changes.push({ kind: "banned", ban, previousTokenVersion: this.state.tokenVersion });
		this.state = { ...this.state, isActive: false, ban, tokenVersion: this.state.tokenVersion.next(), updatedAt: now };
		this.record(new UserCredentialsChanged(this.state.id, "account_banned", now));
	}

	/** A platform admin lifts the ban: the account is active again (its old sessions stay revoked). */
	public unban(now: EpochMs): void {
		const ban = this.state.ban;
		if (ban === null) {
			throw new AccountNotBannedError();
		}
		this.changes.push({ kind: "unbanned", bannedAt: ban.bannedAt, at: now });
		this.state = { ...this.state, isActive: true, ban: null, updatedAt: now };
		this.record(new UserCredentialsChanged(this.state.id, "account_unbanned", now));
	}

	/** A provisioning flow (merchant onboarding of an existing account) refreshes the name. No change, no write. */
	public rename(fullName: string, now: EpochMs): void {
		if (fullName === this.state.fullName) {
			return;
		}
		if (fullName.trim().length === 0) {
			throw new CorruptAggregateStateError("user_account", null, "full name is empty");
		}
		this.state = { ...this.state, fullName, updatedAt: now };
		this.changes.push({ kind: "renamed", fullName, at: now });
		this.record(new UserProfileChanged(this.state.id, now));
	}

	/** Proves the account's password for a provisioning flow (merchant onboarding with an existing account). */
	public assertProvisioningPassword(passwordMatches: boolean): void {
		if (!passwordMatches) {
			throw new InvalidOnboardingPasswordError();
		}
	}

	/** A second factor (or an MFA-assured flow) was just proven. */
	public recordMfaAssurance(now: EpochMs): void {
		this.state = { ...this.state, mfaAssuredAt: now, updatedAt: now };
		this.changes.push({ kind: "mfa_assured", at: now });
	}

	private replacePassword(newPasswordHash: string, matchedRecentPassword: boolean, now: EpochMs, reason: "password_changed" | "password_reset"): void {
		PasswordPolicy.assertNotReused(matchedRecentPassword);
		if (newPasswordHash.length === 0) {
			throw new CorruptAggregateStateError("user_account", null, "the new password hash is empty");
		}
		this.changes.push({ kind: "password_replaced", passwordHash: newPasswordHash, previousTokenVersion: this.state.tokenVersion, at: now });
		this.state = { ...this.state, passwordHash: newPasswordHash, tokenVersion: this.state.tokenVersion.next(), updatedAt: now };
		this.record(new UserCredentialsChanged(this.state.id, reason, now));
	}
}
