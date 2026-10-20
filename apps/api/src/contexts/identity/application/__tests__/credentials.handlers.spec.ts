import { beforeEach, describe, expect, it } from "vitest";
import { epochMs } from "@workspace/shared";

import { PasswordResetToken } from "../../domain/entities/password-reset-token.entity";
import { CurrentPasswordIncorrectError, InvalidCredentialsError, PasswordResetTokenInvalidError, PasswordReusedError } from "../../domain/errors/identity.errors";
import { EmailAddress } from "../../domain/value-objects/email-address.value-object";
import { MAX_FAILED_SIGN_IN_ATTEMPTS } from "../../domain/value-objects/lockout-state.value-object";
import { TokenVersion } from "../../domain/value-objects/token-version.value-object";
import { ChangePasswordCommand } from "../commands/change-password/change-password.command";
import { ChangePasswordHandler } from "../commands/change-password/change-password.handler";
import { LogInCommand } from "../commands/log-in/log-in.command";
import { LogInHandler } from "../commands/log-in/log-in.handler";
import { RequestPasswordResetCommand } from "../commands/request-password-reset/request-password-reset.command";
import { RequestPasswordResetHandler } from "../commands/request-password-reset/request-password-reset.handler";
import { ResetPasswordCommand } from "../commands/reset-password/reset-password.command";
import { ResetPasswordHandler } from "../commands/reset-password/reset-password.handler";
import { signInHarness, type SignInHarness } from "./fakes/identity-sign-in.fakes";
import {
	FakeCredentialCrypto,
	FixedClock,
	InMemoryIdentityStore,
	NOW,
	RecordingFlowSubject,
	SequentialIds,
	TEST_DEVICE,
	accountState,
	anonymousActor,
	sessionState,
	userActor,
} from "./fakes/identity.fakes";

const USER_ID = "user-1";
const EMAIL = "jane@example.com";
const PASSWORD = "Correct-Horse-1";

let store: InMemoryIdentityStore;
let clock: FixedClock;
let flow: RecordingFlowSubject;

beforeEach(() => {
	store = new InMemoryIdentityStore();
	clock = new FixedClock();
	flow = new RecordingFlowSubject();
	store.accounts.seed(accountState({ id: USER_ID, email: EmailAddress.of(EMAIL), passwordHash: `hash:${PASSWORD}` }));
	store.sessions.seed(sessionState({ id: "session-old", userId: USER_ID }));
});

describe("LogInHandler", () => {
	let harness: SignInHarness;

	beforeEach(() => {
		harness = signInHarness(store, clock);
	});

	function logIn(password: string, email: string = EMAIL, clientType: string | undefined = "web"): ReturnType<LogInHandler["execute"]> {
		const handler = new LogInHandler(store.uow, harness.crypto, harness.tokens, harness.grants, new SequentialIds("challenge"), flow, clock, harness.gate);
		return handler.execute(
			new LogInCommand(anonymousActor(), { body: { email, password }, clientType, device: { device: TEST_DEVICE, ipAddress: "198.51.100.7", userAgent: "Firefox" } }),
		);
	}

	it("signs in with the right password: a new device session, the session tokens, the subject named", async () => {
		await expect(logIn(PASSWORD)).resolves.toMatchObject({ accessToken: `access:${USER_ID}:session-1:full`, refreshToken: "refresh:session-1:1" });

		expect(store.sessions.rows.get("session-1")).toMatchObject({ userId: USER_ID, tokenHash: "digest:refresh:session-1:1", signInMethod: "PASSWORD" });
		expect(flow.identified).toEqual([USER_ID]);
		expect(harness.sessionCache.me.has(USER_ID)).toBe(true);
	});

	it("refuses a wrong password and an unknown email alike, counting the failure on the known account", async () => {
		await expect(logIn("wrong")).rejects.toBeInstanceOf(InvalidCredentialsError);
		await expect(logIn(PASSWORD, "nobody@example.com")).rejects.toBeInstanceOf(InvalidCredentialsError);

		expect(store.accounts.rows.get(USER_ID)?.lockout.failedAttempts).toBe(1);
		expect(store.sessions.rows.has("session-1")).toBe(false);
	});

	it("locks the account on the last allowed failure, mails the notice once, and then refuses even the right password", async () => {
		for (let attempt = 0; attempt < MAX_FAILED_SIGN_IN_ATTEMPTS + 1; attempt += 1) {
			await expect(logIn("wrong")).rejects.toBeInstanceOf(InvalidCredentialsError);
		}

		expect(store.emails.kinds()).toEqual(["account_locked"]);
		await expect(logIn(PASSWORD)).rejects.toBeInstanceOf(InvalidCredentialsError);
	});

	it("clears the failure counter after a successful sign-in", async () => {
		await expect(logIn("wrong")).rejects.toBeInstanceOf(InvalidCredentialsError);

		await logIn(PASSWORD);

		expect(store.accounts.rows.get(USER_ID)?.lockout.failedAttempts).toBe(0);
	});

	it("asks for the second factor of an account with 2FA, storing a login challenge and no session", async () => {
		store.accounts.seed(accountState({ id: USER_ID, email: EmailAddress.of(EMAIL), passwordHash: `hash:${PASSWORD}`, twoFactorEnabled: true }));

		await expect(logIn(PASSWORD)).resolves.toEqual({ requiresTwoFactor: true, tempToken: "challenge-ref", message: "Two-factor authentication required" });

		expect(store.challenges.rows.get("challenge-1")).toMatchObject({ userId: USER_ID, purpose: "LOGIN", attemptCount: 0 });
		expect(store.sessions.rows.has("session-1")).toBe(false);
	});

	it("answers the uniform INVALID_CREDENTIALS to the admin panel for an account without dashboard access", async () => {
		await expect(logIn(PASSWORD, EMAIL, "admin")).rejects.toBeInstanceOf(InvalidCredentialsError);
	});

	it("keeps at most five live sessions per user, retiring the oldest at sign-in (D15)", async () => {
		store.sessions.seed(sessionState({ id: "session-old", userId: USER_ID, createdAt: epochMs(NOW - 200) }));
		for (let index = 0; index < 5; index += 1) {
			store.sessions.seed(sessionState({ id: `live-${String(index)}`, userId: USER_ID, createdAt: epochMs(NOW - 100 + index) }));
		}

		await logIn(PASSWORD);

		expect(store.sessions.revokerOf("session-old")).toBe("system:session-limit");
		expect(store.sessions.revokerOf("live-0")).toBe("system:session-limit");
		expect(store.sessions.revokerOf("live-1")).toBeNull();
		expect(store.eventNames()).toEqual(["identity.DeviceSessionsRevoked"]);
	});
});

describe("ChangePasswordHandler", () => {
	function change(currentPassword: string, newPassword: string): ReturnType<ChangePasswordHandler["execute"]> {
		return new ChangePasswordHandler(store.uow, new FakeCredentialCrypto(), flow, clock).execute(
			new ChangePasswordCommand(userActor(USER_ID), { userId: USER_ID, currentPassword, newPassword }),
		);
	}

	it("replaces the password, moves the token generation, signs every device out and mails the notice", async () => {
		await expect(change(PASSWORD, "Battery-Staple-2")).resolves.toEqual({ message: "Password changed successfully" });

		expect(store.accounts.rows.get(USER_ID)).toMatchObject({ passwordHash: "hash:Battery-Staple-2", tokenVersion: TokenVersion.of(2) });
		expect(store.sessions.revokerOf("session-old")).toBe(USER_ID);
		expect(store.emails.kinds()).toEqual(["password_changed"]);
		expect(store.eventNames()).toEqual(["identity.UserCredentialsChanged"]);
	});

	it("refuses a wrong current password and a recently used new one, changing nothing", async () => {
		store.accounts.passwordHistory.set(USER_ID, ["hash:Old-Password-0"]);

		await expect(change("wrong", "Battery-Staple-2")).rejects.toBeInstanceOf(CurrentPasswordIncorrectError);
		await expect(change(PASSWORD, "Old-Password-0")).rejects.toBeInstanceOf(PasswordReusedError);

		expect(store.accounts.rows.get(USER_ID)?.passwordHash).toBe(`hash:${PASSWORD}`);
		expect(store.sessions.revokerOf("session-old")).toBeNull();
		expect(store.emails.sent).toEqual([]);
	});
});

describe("Password reset", () => {
	const crypto = new FakeCredentialCrypto();

	function requestReset(email: string): ReturnType<RequestPasswordResetHandler["execute"]> {
		return new RequestPasswordResetHandler(store.uow, crypto, new SequentialIds("reset"), flow, clock).execute(
			new RequestPasswordResetCommand(anonymousActor(), { email, clientType: "web" }),
		);
	}

	function reset(token: string, password: string): ReturnType<ResetPasswordHandler["execute"]> {
		return new ResetPasswordHandler(store.uow, crypto, flow, clock).execute(new ResetPasswordCommand(anonymousActor(), { token, password }));
	}

	it("issues one usable link per request, expiring the older open ones, and mails it", async () => {
		await requestReset(EMAIL);
		await requestReset(EMAIL);

		const [first, second] = store.emails.sent;
		expect(store.emails.kinds()).toEqual(["password_reset", "password_reset"]);
		expect(await store.resetTokens.findUsableByDigest(`sha:${first?.detail ?? ""}`, NOW)).toBeNull();
		expect(await store.resetTokens.findUsableByDigest(`sha:${second?.detail ?? ""}`, NOW)).toBeInstanceOf(PasswordResetToken);
	});

	it("answers an unknown address exactly like a known one, storing and sending nothing", async () => {
		await expect(requestReset("nobody@example.com")).resolves.toEqual(await requestReset(EMAIL));

		expect(store.resetTokens.rows.size).toBe(1);
		expect(store.emails.sent).toHaveLength(1);
	});

	it("resets with a valid link once: new password, every device signed out by the system, link consumed", async () => {
		await requestReset(EMAIL);
		const [mail] = store.emails.sent;
		const token: string = mail?.detail ?? "";

		await reset(token, "Battery-Staple-2");

		expect(store.accounts.rows.get(USER_ID)?.passwordHash).toBe("hash:Battery-Staple-2");
		expect(store.sessions.revokerOf("session-old")).toBe("system:logout-all");
		expect(flow.identified).toContain(USER_ID);
		await expect(reset(token, "Another-Pass-3")).rejects.toBeInstanceOf(PasswordResetTokenInvalidError);
	});

	it("refuses an unknown link", async () => {
		await expect(reset("forged", "Battery-Staple-2")).rejects.toBeInstanceOf(PasswordResetTokenInvalidError);
	});
});
