import { describe, expect, it } from "vitest";
import { epochMs, type EpochMs } from "@workspace/shared";

import {
	TWO_FACTOR_SETUP_TTL_MS,
	TwoFactorEnrollment,
	type EncryptedTotpSecret,
	type TotpVerification,
	type TwoFactorEnrollmentState,
} from "../aggregates/two-factor-enrollment.aggregate";
import {
	MFA_CHALLENGE_MAX_ATTEMPTS,
	MFA_CHALLENGE_TTL_MS,
	TwoFactorLoginChallenge,
	type TwoFactorLoginChallengeState,
} from "../aggregates/two-factor-login-challenge.aggregate";
import {
	BackupCodeRejectedError,
	InvalidRotationPasswordError,
	InvalidTotpTokenError,
	MfaChallengeAlreadyUsedError,
	MfaChallengeAttemptsExhaustedError,
	MfaChallengeExpiredError,
	MfaChallengePurposeMismatchError,
	TwoFactorAlreadyEnabledError,
	TwoFactorNotConfiguredError,
	TwoFactorNotEnabledError,
	TwoFactorNotEnabledForLoginError,
	TwoFactorSetupExpiredError,
} from "../errors/identity.errors";
import { UserCredentialsChanged } from "../events/identity.events";
import { TokenVersion } from "../value-objects/token-version.value-object";
import { CorruptAggregateStateError } from "../../../../platform/domain/errors/corrupt-aggregate-state.error";

const NOW: EpochMs = epochMs(1_800_000_000_000);
const SECRET: EncryptedTotpSecret = { ciphertext: "cipher", iv: "iv", keyVersion: 1 };
const NEW_SECRET: EncryptedTotpSecret = { ciphertext: "cipher-2", iv: "iv-2", keyVersion: 1 };
const VALID: TotpVerification = { valid: true, timeStep: 42 };
const CODES: readonly string[] = ["code-hash-1", "code-hash-2"];

function enrollment(overrides: Partial<TwoFactorEnrollmentState> = {}): TwoFactorEnrollment {
	return TwoFactorEnrollment.rehydrate({
		userId: "user-1",
		enabled: false,
		secret: null,
		lastTotpStep: null,
		pendingSetup: null,
		activeBackupCodes: [],
		tokenVersion: TokenVersion.of(1),
		...overrides,
	});
}

function enabled(): TwoFactorEnrollment {
	return enrollment({ enabled: true, secret: SECRET, lastTotpStep: 41, activeBackupCodes: [{ id: "code-1", codeHash: "code-hash-1" }] });
}

describe("TwoFactorEnrollment setup and enable", () => {
	it("starts a setup that expires after the setup window", () => {
		const subject = enrollment();

		subject.startSetup(SECRET, CODES, NOW);

		expect(subject.pendingSecretAt(epochMs(NOW + TWO_FACTOR_SETUP_TTL_MS))).toEqual(SECRET);
		expect(() => subject.pendingSecretAt(epochMs(NOW + TWO_FACTOR_SETUP_TTL_MS + 1))).toThrow(TwoFactorSetupExpiredError);
		expect(subject.pendingChanges).toEqual([{ kind: "setup_started", setup: { secret: SECRET, backupCodeHashes: CODES, expiresAt: NOW + TWO_FACTOR_SETUP_TTL_MS } }]);
	});

	it("refuses a setup for an account that already has 2FA, and a setup without backup codes", () => {
		expect(() => {
			enabled().startSetup(SECRET, CODES, NOW);
		}).toThrow(TwoFactorAlreadyEnabledError);
		expect(() => {
			enrollment().startSetup(SECRET, [], NOW);
		}).toThrow(CorruptAggregateStateError);
	});

	it("enables with a valid code: stores the secret and step, bumps the token generation in the same write (D16)", () => {
		const subject = enrollment();
		subject.startSetup(SECRET, CODES, NOW);

		subject.enable(VALID, SECRET, epochMs(NOW + 1));

		expect(subject.enabled).toBe(true);
		expect(subject.lastTotpStep).toBe(42);
		expect(subject.pendingChanges.at(-1)).toEqual({
			kind: "enabled",
			secret: SECRET,
			lastTotpStep: 42,
			enrolledAt: NOW + 1,
			backupCodeHashes: CODES,
			previousTokenVersion: TokenVersion.of(1),
		});
		const [event] = subject.pullEvents();
		expect(event).toBeInstanceOf(UserCredentialsChanged);
		expect(event).toMatchObject({ reason: "two_factor_enabled" });
	});

	it("refuses to enable with a wrong code, or after the setup expired", () => {
		const subject = enrollment();
		subject.startSetup(SECRET, CODES, NOW);

		expect(() => {
			subject.enable({ valid: false }, SECRET, NOW);
		}).toThrow(InvalidTotpTokenError);
		expect(() => {
			subject.enable(VALID, SECRET, epochMs(NOW + TWO_FACTOR_SETUP_TTL_MS + 1));
		}).toThrow(TwoFactorSetupExpiredError);
		expect(() => {
			enrollment().enable(VALID, SECRET, NOW);
		}).toThrow(TwoFactorSetupExpiredError);
	});

	it("refuses a stored pending setup without backup codes as corrupt", () => {
		expect(() => enrollment({ pendingSetup: { secret: SECRET, backupCodeHashes: [], expiresAt: NOW } })).toThrow(CorruptAggregateStateError);
	});
});

describe("TwoFactorEnrollment rotation", () => {
	it("needs the password, then a valid code; clears the old factor, bumps the generation and starts a new setup", () => {
		const subject = enabled();

		subject.rotate(true, { kind: "totp", verification: VALID }, { secret: NEW_SECRET, backupCodeHashes: CODES }, NOW);

		expect(subject.enabled).toBe(false);
		expect(subject.pendingChanges.map((change) => change.kind)).toEqual(["cleared", "setup_started"]);
		expect(subject.pendingSecretAt(NOW)).toEqual(NEW_SECRET);
		expect(subject.pullEvents()).toEqual([expect.objectContaining({ reason: "two_factor_rotated" })]);
	});

	it("consumes the backup code used as the second factor in the same write (D17)", () => {
		const subject = enabled();

		subject.rotate(true, { kind: "backup_code", matchedCodeId: "code-1" }, { secret: NEW_SECRET, backupCodeHashes: CODES }, NOW);

		expect(subject.pendingChanges.at(0)).toEqual({ kind: "backup_code_consumed", codeId: "code-1", consumedAt: NOW });
	});

	it("refuses a wrong password, a wrong code, an unknown backup code, or an account without 2FA", () => {
		const newSetup = { secret: NEW_SECRET, backupCodeHashes: CODES };
		expect(() => {
			enabled().rotate(false, { kind: "totp", verification: VALID }, newSetup, NOW);
		}).toThrow(InvalidRotationPasswordError);
		expect(() => {
			enabled().rotate(true, { kind: "totp", verification: { valid: false } }, newSetup, NOW);
		}).toThrow(InvalidTotpTokenError);
		expect(() => {
			enabled().rotate(true, { kind: "backup_code", matchedCodeId: null }, newSetup, NOW);
		}).toThrow(BackupCodeRejectedError);
		expect(() => {
			enrollment().rotate(true, { kind: "totp", verification: VALID }, newSetup, NOW);
		}).toThrow(TwoFactorNotEnabledError);
	});
});

describe("TwoFactorEnrollment at sign-in", () => {
	it("hands out the secret only for an enabled, configured factor", () => {
		expect(enabled().enabledSecretForLogin()).toEqual(SECRET);
		expect(enabled().enabledSecretForRotation()).toEqual(SECRET);
		expect(() => enrollment().enabledSecretForLogin()).toThrow(TwoFactorNotEnabledForLoginError);
		expect(() => enrollment({ enabled: true, secret: null }).enabledSecretForLogin()).toThrow(TwoFactorNotConfiguredError);
	});

	it("records an accepted code's time step (the store writes it only when newer, D13); a wrong code changes nothing", () => {
		const subject = enabled();

		expect(subject.acceptLoginCode({ valid: false }, NOW)).toBe(false);
		expect(subject.pendingChanges).toEqual([]);
		expect(subject.acceptLoginCode(VALID, NOW)).toBe(true);
		expect(subject.pendingChanges).toEqual([{ kind: "login_totp_accepted", timeStep: 42, assuredAt: NOW }]);
	});

	it("consumes a matched backup code once and refuses an unknown one", () => {
		const subject = enabled();

		subject.consumeBackupCodeForLogin("code-1", NOW);

		expect(subject.activeBackupCodes).toEqual([]);
		expect(() => {
			subject.consumeBackupCodeForLogin(null, NOW);
		}).toThrow(BackupCodeRejectedError);
	});
});

describe("TwoFactorLoginChallenge", () => {
	function challenge(overrides: Partial<TwoFactorLoginChallengeState> = {}): TwoFactorLoginChallenge {
		return TwoFactorLoginChallenge.rehydrate({
			id: "challenge-1",
			userId: "user-1",
			purpose: "LOGIN",
			clientType: "web",
			deviceInfo: null,
			ipAddress: null,
			attemptCount: 0,
			maxAttempts: MFA_CHALLENGE_MAX_ATTEMPTS,
			consumedAt: null,
			expiresAt: epochMs(NOW + MFA_CHALLENGE_TTL_MS),
			...overrides,
		});
	}

	it("opens with no attempts, expiring after the challenge window", () => {
		const opened = TwoFactorLoginChallenge.open({ id: "c", userId: "user-1", purpose: "LOGIN", clientType: null, deviceInfo: null, ipAddress: null }, NOW);

		expect(opened.snapshot).toMatchObject({ attemptCount: 0, maxAttempts: MFA_CHALLENGE_MAX_ATTEMPTS, consumedAt: null, expiresAt: NOW + MFA_CHALLENGE_TTL_MS });
	});

	it("is usable once, before it expires and before its attempts run out", () => {
		expect(() => {
			challenge().assertActiveAt(NOW);
		}).not.toThrow();
		expect(() => {
			challenge({ consumedAt: NOW }).assertActiveAt(NOW);
		}).toThrow(MfaChallengeAlreadyUsedError);
		expect(() => {
			challenge({ expiresAt: epochMs(NOW - 1) }).assertActiveAt(NOW);
		}).toThrow(MfaChallengeExpiredError);
		expect(() => {
			challenge({ attemptCount: MFA_CHALLENGE_MAX_ATTEMPTS }).assertActiveAt(NOW);
		}).toThrow(MfaChallengeAttemptsExhaustedError);
	});

	it("refuses a challenge minted for another purpose", () => {
		expect(() => {
			challenge().assertPurpose("ROTATE");
		}).toThrow(MfaChallengePurposeMismatchError);
	});

	it("consumes once: a second consume fails as already used", () => {
		const subject = challenge();

		subject.consume(NOW);

		expect(subject.wasConsumed).toBe(true);
		expect(subject.snapshot.consumedAt).toBe(NOW);
		expect(() => {
			subject.consume(NOW);
		}).toThrow(MfaChallengeAlreadyUsedError);
	});

	it("reports exhaustion from the counter the store returned", () => {
		expect(challenge().isExhaustedBy(MFA_CHALLENGE_MAX_ATTEMPTS - 1)).toBe(false);
		expect(challenge().isExhaustedBy(MFA_CHALLENGE_MAX_ATTEMPTS)).toBe(true);
	});

	it("refuses corrupt attempt counters", () => {
		expect(() => challenge({ attemptCount: -1 })).toThrow(CorruptAggregateStateError);
		expect(() => challenge({ maxAttempts: 0 })).toThrow(CorruptAggregateStateError);
	});
});
