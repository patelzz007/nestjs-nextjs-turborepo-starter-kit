import { beforeEach, describe, expect, it } from "vitest";
import { epochMs } from "@workspace/shared";

import { TwoFactorEnrollment, type TwoFactorEnrollmentState } from "../../domain/aggregates/two-factor-enrollment.aggregate";
import { MFA_CHALLENGE_MAX_ATTEMPTS, MFA_CHALLENGE_TTL_MS } from "../../domain/aggregates/two-factor-login-challenge.aggregate";
import {
	BackupCodeRejectedError,
	InvalidCredentialsError,
	InvalidRotationPasswordError,
	InvalidTotpTokenError,
	InvalidTwoFactorCodeError,
	MfaChallengeAlreadyUsedError,
	MfaChallengePurposeMismatchError,
	TwoFactorAlreadyEnabledError,
} from "../../domain/errors/identity.errors";
import { EmailAddress } from "../../domain/value-objects/email-address.value-object";
import { TokenVersion } from "../../domain/value-objects/token-version.value-object";
import { CompleteBackupCodeLoginCommand } from "../commands/complete-backup-code-login/complete-backup-code-login.command";
import { CompleteBackupCodeLoginHandler } from "../commands/complete-backup-code-login/complete-backup-code-login.handler";
import { CompleteTotpLoginCommand } from "../commands/complete-totp-login/complete-totp-login.command";
import { CompleteTotpLoginHandler } from "../commands/complete-totp-login/complete-totp-login.handler";
import { EnableTwoFactorCommand } from "../commands/enable-two-factor/enable-two-factor.command";
import { EnableTwoFactorHandler } from "../commands/enable-two-factor/enable-two-factor.handler";
import { RotateTwoFactorCommand } from "../commands/rotate-two-factor/rotate-two-factor.command";
import { RotateTwoFactorHandler } from "../commands/rotate-two-factor/rotate-two-factor.handler";
import { StartTwoFactorSetupCommand } from "../commands/start-two-factor-setup/start-two-factor-setup.command";
import { StartTwoFactorSetupHandler } from "../commands/start-two-factor-setup/start-two-factor-setup.handler";
import { MfaLoginCompletion } from "../services/mfa-login-completion";
import { signInHarness, type SignInHarness } from "./fakes/identity-sign-in.fakes";
import {
	FakeAuthenticator,
	FakeCredentialCrypto,
	FakeTotpCipher,
	FixedClock,
	InMemoryIdentityStore,
	NOW,
	TEST_DEVICE,
	TEST_SETTINGS,
	VALID_TOTP_CODE,
	VALID_TOTP_STEP,
	accountState,
	anonymousActor,
	userActor,
} from "./fakes/identity.fakes";

const USER_ID = "user-1";
const EMAIL = "jane@example.com";
const PASSWORD = "Correct-Horse-1";
const cipher = new FakeTotpCipher();
const authenticator = new FakeAuthenticator();
const crypto = new FakeCredentialCrypto();

let store: InMemoryIdentityStore;
let clock: FixedClock;

function enrollment(overrides: Partial<TwoFactorEnrollmentState> = {}): TwoFactorEnrollment {
	return TwoFactorEnrollment.rehydrate({
		userId: USER_ID,
		enabled: false,
		secret: null,
		lastTotpStep: null,
		pendingSetup: null,
		activeBackupCodes: [],
		tokenVersion: TokenVersion.of(1),
		...overrides,
	});
}

/** An enrolled account: secret stored, one unused backup code, the last accepted step before {@link VALID_TOTP_STEP}. */
function enrolled(): TwoFactorEnrollment {
	return enrollment({
		enabled: true,
		secret: cipher.encrypt("JBSWY3DPEHPK3PXP", "totp-secret"),
		lastTotpStep: VALID_TOTP_STEP - 1,
		activeBackupCodes: [{ id: "code-1", codeHash: "hash:BACKUP-OLD" }],
	});
}

beforeEach(() => {
	store = new InMemoryIdentityStore();
	clock = new FixedClock();
	store.accounts.seed(accountState({ id: USER_ID, email: EmailAddress.of(EMAIL), passwordHash: `hash:${PASSWORD}` }));
});

describe("Two-factor enrollment", () => {
	it("starts a setup: the secret, QR code and backup codes go to the user, only hashes are kept", async () => {
		store.twoFactor.enrollments.set(USER_ID, enrollment());

		const setup = await new StartTwoFactorSetupHandler(store.uow, authenticator, cipher, crypto, TEST_SETTINGS, clock).execute(
			new StartTwoFactorSetupCommand(userActor(USER_ID), { userId: USER_ID }),
		);

		expect(setup).toMatchObject({
			secret: "JBSWY3DPEHPK3PXP",
			backupCodes: ["BACKUP-ONE", "BACKUP-TWO"],
			otpAuthUrl: "otpauth://totp/Starter Kit:jane@example.com?secret=JBSWY3DPEHPK3PXP",
		});
		expect(store.twoFactor.saved.at(-1)?.pendingChanges.at(-1)).toMatchObject({
			kind: "setup_started",
			setup: { secret: { ciphertext: "totp-pending|JBSWY3DPEHPK3PXP" }, backupCodeHashes: ["hash:BACKUP-ONE", "hash:BACKUP-TWO"] },
		});
	});

	it("refuses a new setup while 2FA is on", async () => {
		store.twoFactor.enrollments.set(USER_ID, enrolled());

		await expect(
			new StartTwoFactorSetupHandler(store.uow, authenticator, cipher, crypto, TEST_SETTINGS, clock).execute(
				new StartTwoFactorSetupCommand(userActor(USER_ID), { userId: USER_ID }),
			),
		).rejects.toBeInstanceOf(TwoFactorAlreadyEnabledError);
	});

	it("enables with a valid code from the pending secret, re-encrypting it as the live secret, and mails the notice", async () => {
		const subject = enrollment();
		subject.startSetup(cipher.encrypt("JBSWY3DPEHPK3PXP", "totp-pending"), ["hash:BACKUP-ONE"], NOW);
		store.twoFactor.enrollments.set(USER_ID, subject);
		const handler = new EnableTwoFactorHandler(store.uow, authenticator, cipher, clock);

		await expect(handler.execute(new EnableTwoFactorCommand(userActor(USER_ID), { userId: USER_ID, token: "000000" }))).rejects.toBeInstanceOf(InvalidTotpTokenError);
		await handler.execute(new EnableTwoFactorCommand(userActor(USER_ID), { userId: USER_ID, token: VALID_TOTP_CODE }));

		expect(subject.enabled).toBe(true);
		expect(subject.pendingChanges.at(-1)).toMatchObject({ kind: "enabled", secret: { ciphertext: "totp-secret|JBSWY3DPEHPK3PXP" }, lastTotpStep: VALID_TOTP_STEP });
		expect(store.emails.kinds()).toEqual(["two_factor_enabled"]);
		expect(store.eventNames()).toEqual(["identity.UserCredentialsChanged"]);
	});

	it("rotates only with the password and a second factor, handing out a fresh setup", async () => {
		const subject = enrolled();
		store.twoFactor.enrollments.set(USER_ID, subject);
		const handler = new RotateTwoFactorHandler(store.uow, authenticator, cipher, crypto, TEST_SETTINGS, clock);
		const rotate = (password: string, token: string | undefined, backupCode: string | undefined): ReturnType<RotateTwoFactorHandler["execute"]> =>
			handler.execute(new RotateTwoFactorCommand(userActor(USER_ID), { userId: USER_ID, password, token, backupCode }));

		await expect(rotate("wrong", VALID_TOTP_CODE, undefined)).rejects.toBeInstanceOf(InvalidRotationPasswordError);
		await expect(rotate(PASSWORD, undefined, "BACKUP-NOPE")).rejects.toBeInstanceOf(BackupCodeRejectedError);
		await expect(rotate(PASSWORD, undefined, "BACKUP-OLD")).resolves.toMatchObject({ backupCodes: ["BACKUP-ONE", "BACKUP-TWO"] });

		expect(subject.enabled).toBe(false);
		expect(subject.pendingChanges.map((change) => change.kind)).toEqual(["backup_code_consumed", "cleared", "setup_started"]);
	});
});

describe("Completing a sign-in with the second factor", () => {
	const TEMP_TOKEN = "temp-token";
	let harness: SignInHarness;

	beforeEach(() => {
		harness = signInHarness(store, clock);
		store.accounts.seed(accountState({ id: USER_ID, email: EmailAddress.of(EMAIL), twoFactorEnabled: true }));
		store.twoFactor.enrollments.set(USER_ID, enrolled());
		store.challenges.rows.set("challenge-1", {
			id: "challenge-1",
			userId: USER_ID,
			purpose: "LOGIN",
			clientType: "web",
			deviceInfo: "Firefox",
			ipAddress: null,
			attemptCount: 0,
			maxAttempts: MFA_CHALLENGE_MAX_ATTEMPTS,
			consumedAt: null,
			expiresAt: epochMs(NOW + MFA_CHALLENGE_TTL_MS),
		});
		harness.tokens.challengeRefs.set(TEMP_TOKEN, { userId: USER_ID, challengeId: "challenge-1", purpose: "LOGIN", clientType: "web", deviceInfo: "Firefox", ipAddress: null });
	});

	function completion(): MfaLoginCompletion {
		return new MfaLoginCompletion(store.uow, harness.tokens, clock, harness.gate);
	}

	function withTotp(token: string): ReturnType<CompleteTotpLoginHandler["execute"]> {
		return new CompleteTotpLoginHandler(store.uow, authenticator, cipher, clock, completion()).execute(
			new CompleteTotpLoginCommand(anonymousActor(), { tempToken: TEMP_TOKEN, token, device: { device: TEST_DEVICE, ipAddress: null, userAgent: "Firefox" } }),
		);
	}

	function withBackupCode(backupCode: string): ReturnType<CompleteBackupCodeLoginHandler["execute"]> {
		return new CompleteBackupCodeLoginHandler(store.uow, crypto, clock, completion()).execute(
			new CompleteBackupCodeLoginCommand(anonymousActor(), { tempToken: TEMP_TOKEN, backupCode, device: { device: TEST_DEVICE, ipAddress: null, userAgent: "Firefox" } }),
		);
	}

	it("issues the session after a valid code: challenge consumed, step recorded, MFA assurance stamped", async () => {
		await expect(withTotp(VALID_TOTP_CODE)).resolves.toMatchObject({ accessToken: `access:${USER_ID}:session-1:full` });

		expect(store.challenges.rows.get("challenge-1")?.consumedAt).toBe(NOW);
		expect(store.accounts.rows.get(USER_ID)?.mfaAssuredAt).toBe(NOW);
		expect(store.sessions.rows.get("session-1")).toMatchObject({ signInMethod: "PASSWORD_TOTP" });
		await expect(withTotp(VALID_TOTP_CODE)).rejects.toBeInstanceOf(MfaChallengeAlreadyUsedError);
	});

	it("counts a wrong code on the challenge, and the last allowed one burns it as a failed sign-in (D19)", async () => {
		for (let attempt = 1; attempt < MFA_CHALLENGE_MAX_ATTEMPTS; attempt += 1) {
			await expect(withTotp("000000")).rejects.toBeInstanceOf(InvalidTwoFactorCodeError);
		}
		await expect(withTotp("000000")).rejects.toBeInstanceOf(InvalidCredentialsError);

		expect(store.challenges.rows.get("challenge-1")).toMatchObject({ attemptCount: MFA_CHALLENGE_MAX_ATTEMPTS, consumedAt: NOW });
		expect(store.accounts.rows.get(USER_ID)?.lockout.failedAttempts).toBe(1);
		expect(store.sessions.rows.size).toBe(0);
	});

	it("refuses a reference minted for another purpose", async () => {
		harness.tokens.challengeRefs.set(TEMP_TOKEN, { userId: USER_ID, challengeId: "challenge-1", purpose: "ROTATE", clientType: "web", deviceInfo: null, ipAddress: null });

		await expect(withTotp(VALID_TOTP_CODE)).rejects.toBeInstanceOf(MfaChallengePurposeMismatchError);
	});

	it("signs in with an unused backup code once, and refuses an unknown one", async () => {
		await expect(withBackupCode("BACKUP-NOPE")).rejects.toBeInstanceOf(BackupCodeRejectedError);
		await expect(withBackupCode("BACKUP-OLD")).resolves.toMatchObject({ accessToken: `access:${USER_ID}:session-1:full` });

		expect(store.twoFactor.enrollments.get(USER_ID)?.activeBackupCodes).toEqual([]);
		expect(store.sessions.rows.get("session-1")).toMatchObject({ signInMethod: "PASSWORD_BACKUP_CODE" });
	});
});
