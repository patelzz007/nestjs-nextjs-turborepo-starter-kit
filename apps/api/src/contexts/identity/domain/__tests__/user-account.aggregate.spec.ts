import { describe, expect, it } from "vitest";
import { epochMs, type EpochMs } from "@workspace/shared";

import { UserAccount, type UserAccountState } from "../aggregates/user-account.aggregate";
import {
	CorruptIdentityStateError,
	CredentialAccountMissingError,
	CurrentPasswordIncorrectError,
	InvalidOnboardingPasswordError,
	PasswordReusedError,
} from "../errors/identity.errors";
import { UserCredentialsChanged, UserProfileChanged } from "../events/identity.events";
import { EmailAddress } from "../value-objects/email-address.value-object";
import { LockoutState, MAX_FAILED_SIGN_IN_ATTEMPTS } from "../value-objects/lockout-state.value-object";
import { TokenVersion } from "../value-objects/token-version.value-object";

const NOW: EpochMs = epochMs(1_800_000_000_000);
const LATER: EpochMs = epochMs(NOW + 1_000);

function state(overrides: Partial<UserAccountState> = {}): UserAccountState {
	return {
		id: "user-1",
		email: EmailAddress.of("jane@example.com"),
		fullName: "Jane Doe",
		passwordHash: "hash-1",
		isActive: true,
		isSuperAdmin: false,
		isDeleted: false,
		deletedAt: null,
		emailVerifiedAt: NOW,
		tokenVersion: TokenVersion.of(2),
		lockout: LockoutState.clear(),
		twoFactorEnabled: false,
		mfaEnrollmentDeadline: null,
		mfaAssuredAt: null,
		createdAt: NOW,
		updatedAt: NOW,
		...overrides,
	};
}

describe("UserAccount.register", () => {
	it("starts active, unlocked, at token generation 0, without 2FA", () => {
		const account = UserAccount.register(
			{
				id: "user-1",
				email: EmailAddress.of("jane@example.com"),
				fullName: "Jane",
				passwordHash: "hash",
				isSuperAdmin: false,
				emailVerifiedAt: null,
				mfaEnrollmentDeadline: null,
			},
			NOW,
		);

		expect(account.isNew).toBe(true);
		expect(account.canSignIn()).toBe(true);
		expect(account.tokenVersion.value).toBe(0);
		expect(account.twoFactorEnabled).toBe(false);
		expect(account.awaitsEmailVerification()).toBe(true);
		expect(account.snapshot.createdAt).toBe(NOW);
	});

	it("refuses an empty full name", () => {
		expect(() =>
			UserAccount.register(
				{
					id: "user-1",
					email: EmailAddress.of("jane@example.com"),
					fullName: "  ",
					passwordHash: "hash",
					isSuperAdmin: false,
					emailVerifiedAt: null,
					mfaEnrollmentDeadline: null,
				},
				NOW,
			),
		).toThrow(CorruptIdentityStateError);
	});
});

describe("UserAccount.rehydrate", () => {
	it("refuses a stored account without a password hash", () => {
		expect(() => UserAccount.rehydrate(state({ passwordHash: "" }))).toThrow(CorruptIdentityStateError);
	});

	it("keeps the loaded token generation as its compare-and-set token", () => {
		const account = UserAccount.rehydrate(state());

		expect(account.isNew).toBe(false);
		expect(account.concurrencyToken.value).toBe(2);
	});
});

describe("UserAccount.evaluatePasswordSignIn", () => {
	it("refuses a locked account without counting the attempt", () => {
		const locked = UserAccount.rehydrate(state({ lockout: LockoutState.of(MAX_FAILED_SIGN_IN_ATTEMPTS, LATER) }));

		expect(locked.evaluatePasswordSignIn(true, NOW)).toBe("locked");
	});

	it("rejects a wrong password, an inactive account and a deleted one alike", () => {
		expect(UserAccount.rehydrate(state()).evaluatePasswordSignIn(false, NOW)).toBe("rejected");
		expect(UserAccount.rehydrate(state({ isActive: false })).evaluatePasswordSignIn(true, NOW)).toBe("rejected");
		expect(UserAccount.rehydrate(state({ isDeleted: true })).evaluatePasswordSignIn(true, NOW)).toBe("rejected");
	});

	it("accepts the right password once an expired lock ended", () => {
		const unlockedAgain = UserAccount.rehydrate(state({ lockout: LockoutState.of(MAX_FAILED_SIGN_IN_ATTEMPTS, NOW) }));

		expect(unlockedAgain.evaluatePasswordSignIn(true, NOW)).toBe("accepted");
	});
});

describe("UserAccount password changes", () => {
	it("checks the current password of a live account first", () => {
		expect(() => {
			UserAccount.rehydrate(state()).assertCurrentPassword(false);
		}).toThrow(CurrentPasswordIncorrectError);
		expect(() => {
			UserAccount.rehydrate(state({ isDeleted: true })).assertCurrentPassword(true);
		}).toThrow(CredentialAccountMissingError);
		expect(() => {
			UserAccount.rehydrate(state()).assertCurrentPassword(true);
		}).not.toThrow();
	});

	it("replaces the hash, bumps the token generation and records the change against the loaded generation (D35)", () => {
		const account = UserAccount.rehydrate(state());

		account.changePassword("hash-2", false, LATER);

		expect(account.passwordHash).toBe("hash-2");
		expect(account.tokenVersion.value).toBe(3);
		expect(account.pendingChanges).toEqual([{ kind: "password_replaced", passwordHash: "hash-2", previousTokenVersion: TokenVersion.of(2), at: LATER }]);
		const [event] = account.pullEvents();
		expect(event).toBeInstanceOf(UserCredentialsChanged);
		expect(event).toMatchObject({ userId: "user-1", reason: "password_changed" });
	});

	it("records a reset as its own reason", () => {
		const account = UserAccount.rehydrate(state());

		account.resetPassword("hash-2", false, LATER);

		expect(account.pullEvents()).toEqual([expect.objectContaining({ reason: "password_reset" })]);
	});

	it("refuses a recently used password and writes nothing", () => {
		const account = UserAccount.rehydrate(state());

		expect(() => {
			account.changePassword("hash-2", true, LATER);
		}).toThrow(PasswordReusedError);
		expect(account.pendingChanges).toEqual([]);
		expect(account.tokenVersion.value).toBe(2);
	});

	it("refuses an empty new hash as corrupt", () => {
		expect(() => {
			UserAccount.rehydrate(state()).resetPassword("", false, LATER);
		}).toThrow(CorruptIdentityStateError);
	});
});

describe("UserAccount email verification, unlock, rename and MFA assurance", () => {
	it("verifies once: a second verification changes nothing", () => {
		const account = UserAccount.rehydrate(state({ emailVerifiedAt: null }));

		expect(account.verifyEmail(LATER)).toBe(true);
		expect(account.verifyEmail(LATER)).toBe(false);
		expect(account.isEmailVerifiedAt(LATER)).toBe(true);
		expect(account.pendingChanges).toEqual([{ kind: "email_verified", at: LATER }]);
		expect(account.pullEvents()).toEqual([expect.any(UserProfileChanged)]);
	});

	it("treats a verification time in the future as not verified yet", () => {
		expect(UserAccount.rehydrate(state({ emailVerifiedAt: LATER })).isEmailVerifiedAt(NOW)).toBe(false);
	});

	it("clears the lockout on unlock and drops the cached state everywhere (D18)", () => {
		const account = UserAccount.rehydrate(state({ lockout: LockoutState.of(MAX_FAILED_SIGN_IN_ATTEMPTS, LATER) }));

		account.unlock(NOW);

		expect(account.lockout.isDirty()).toBe(false);
		expect(account.pendingChanges).toEqual([{ kind: "lockout_cleared", at: NOW }]);
		expect(account.pullEvents()).toEqual([expect.objectContaining({ reason: "account_unlocked" })]);
	});

	it("renames only when the name changes, and never to an empty name", () => {
		const account = UserAccount.rehydrate(state());

		account.rename("Jane Doe", LATER);
		expect(account.pendingChanges).toEqual([]);
		account.rename("Jane Smith", LATER);
		expect(account.fullName).toBe("Jane Smith");
		expect(account.pendingChanges).toEqual([{ kind: "renamed", fullName: "Jane Smith", at: LATER }]);
		expect(() => {
			account.rename(" ", LATER);
		}).toThrow(CorruptIdentityStateError);
	});

	it("checks a provisioning flow's password proof", () => {
		expect(() => {
			UserAccount.rehydrate(state()).assertProvisioningPassword(false);
		}).toThrow(InvalidOnboardingPasswordError);
	});

	it("reports MFA assurance only once it is not in the future", () => {
		const account = UserAccount.rehydrate(state());

		account.recordMfaAssurance(LATER);

		expect(account.mfaAssuranceAt(NOW)).toBeNull();
		expect(account.mfaAssuranceAt(LATER)).toBe(LATER);
		expect(account.pendingChanges).toEqual([{ kind: "mfa_assured", at: LATER }]);
	});
});
