import { describe, expect, it } from "vitest";
import { epochMs } from "@workspace/shared";

import { CorruptIdentityStateError, InvalidEmailAddressError, PasswordReusedError, WeakPasswordError } from "../errors/identity.errors";
import { EmailAddress } from "../value-objects/email-address.value-object";
import { LOCKOUT_DURATION_MS, LockoutState, MAX_FAILED_SIGN_IN_ATTEMPTS } from "../value-objects/lockout-state.value-object";
import { PasswordPolicy } from "../value-objects/password-policy.value-object";
import { TokenVersion } from "../value-objects/token-version.value-object";

const NOW = epochMs(1_800_000_000_000);

describe("EmailAddress", () => {
	it("canonicalises to lower case, so addresses differing only in case are one account", () => {
		const address = EmailAddress.of("Jane.Doe@Example.COM");

		expect(address.value).toBe("jane.doe@example.com");
		expect(address.equals(EmailAddress.of("jane.doe@example.com"))).toBe(true);
		expect(address.toString()).toBe("jane.doe@example.com");
	});

	it("refuses what the shared contract rejects", () => {
		expect(() => EmailAddress.of("not-an-email")).toThrow(InvalidEmailAddressError);
		expect(() => EmailAddress.of("")).toThrow(InvalidEmailAddressError);
	});
});

describe("TokenVersion", () => {
	it("moves forward by one generation and compares by value", () => {
		const version = TokenVersion.of(3);

		expect(version.next().value).toBe(4);
		expect(version.equals(TokenVersion.of(3))).toBe(true);
		expect(version.equals(version.next())).toBe(false);
	});

	it("refuses a negative or fractional generation as corrupt state", () => {
		expect(() => TokenVersion.of(-1)).toThrow(CorruptIdentityStateError);
		expect(() => TokenVersion.of(1.5)).toThrow(CorruptIdentityStateError);
	});
});

describe("LockoutState", () => {
	it("locks on the attempt that reaches the limit, for the lockout duration", () => {
		const almost = LockoutState.of(MAX_FAILED_SIGN_IN_ATTEMPTS - 1, null);

		const outcome = almost.afterFailedAttempt(NOW);

		expect(outcome.lockedNow).toBe(true);
		expect(outcome.state.failedAttempts).toBe(MAX_FAILED_SIGN_IN_ATTEMPTS);
		expect(outcome.state.lockedUntil).toBe(NOW + LOCKOUT_DURATION_MS);
		expect(outcome.state.isLockedAt(NOW)).toBe(true);
	});

	it("counts attempts below the limit without locking", () => {
		const outcome = LockoutState.clear().afterFailedAttempt(NOW);

		expect(outcome).toMatchObject({ lockedNow: false });
		expect(outcome.state.failedAttempts).toBe(1);
		expect(outcome.state.lockedUntil).toBeNull();
	});

	it("never takes a second lock while one is running (a burst locks exactly once)", () => {
		const locked = LockoutState.of(MAX_FAILED_SIGN_IN_ATTEMPTS, LockoutState.lockEndsAt(NOW));

		const outcome = locked.afterFailedAttempt(epochMs(NOW + 1));

		expect(outcome.lockedNow).toBe(false);
		expect(outcome.state.lockedUntil).toBe(locked.lockedUntil);
	});

	it("is locked only while the lock end is strictly in the future", () => {
		const lockedUntil = epochMs(NOW + 10);
		const state = LockoutState.of(MAX_FAILED_SIGN_IN_ATTEMPTS, lockedUntil);

		expect(state.isLockedAt(NOW)).toBe(true);
		expect(state.isLockedAt(lockedUntil)).toBe(false);
	});

	it("reports dirty state (a counter or a stale lock) so an unlock knows there is something to reset", () => {
		expect(LockoutState.clear().isDirty()).toBe(false);
		expect(LockoutState.of(1, null).isDirty()).toBe(true);
		expect(LockoutState.of(0, epochMs(NOW - 1)).isDirty()).toBe(true);
		expect(LockoutState.of(2, null).equals(LockoutState.of(2, null))).toBe(true);
	});

	it("refuses a negative counter as corrupt state", () => {
		expect(() => LockoutState.of(-1, null)).toThrow(CorruptIdentityStateError);
	});
});

describe("PasswordPolicy", () => {
	it("applies the shared strength contract", () => {
		expect(() => {
			PasswordPolicy.assertStrong("weak");
		}).toThrow(WeakPasswordError);
		expect(() => {
			PasswordPolicy.assertStrong("Str0ng-Enough-Passw0rd!");
		}).not.toThrow();
	});

	it("refuses one of the recent passwords", () => {
		expect(() => {
			PasswordPolicy.assertNotReused(true);
		}).toThrow(PasswordReusedError);
		expect(() => {
			PasswordPolicy.assertNotReused(false);
		}).not.toThrow();
	});
});
