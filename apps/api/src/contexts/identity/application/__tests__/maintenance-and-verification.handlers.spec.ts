import { beforeEach, describe, expect, it } from "vitest";
import { epochMs } from "@workspace/shared";

import { systemActor } from "../../../../platform/application/actor-context";
import { PasswordResetToken, USED_RESET_TOKEN_RETENTION_MS } from "../../domain/entities/password-reset-token.entity";
import {
	BootstrapEmailTakenError,
	InvalidLoginVerificationCodeError,
	LoginVerificationAttemptsExceededError,
	LoginVerificationExpiredError,
	SuperAdminAlreadyExistsError,
	SuperAdminRoleMissingError,
} from "../../domain/errors/identity.errors";
import { EmailAddress } from "../../domain/value-objects/email-address.value-object";
import { BootstrapSuperAdminCommand } from "../commands/bootstrap-super-admin/bootstrap-super-admin.command";
import { BootstrapSuperAdminHandler, SUPER_ADMIN_ROLE_NAME } from "../commands/bootstrap-super-admin/bootstrap-super-admin.handler";
import { LogInCommand } from "../commands/log-in/log-in.command";
import { LogInHandler } from "../commands/log-in/log-in.handler";
import { PurgeStalePasswordResetTokensCommand } from "../commands/purge-stale-password-reset-tokens/purge-stale-password-reset-tokens.command";
import { PurgeStalePasswordResetTokensHandler } from "../commands/purge-stale-password-reset-tokens/purge-stale-password-reset-tokens.handler";
import { VerifyNewDeviceLoginCommand } from "../commands/verify-new-device-login/verify-new-device-login.command";
import { VerifyNewDeviceLoginHandler } from "../commands/verify-new-device-login/verify-new-device-login.handler";
import type { OperatorIdentity, OperatorIdentityPort } from "../ports/operator-identity.port";
import { MAX_LOGIN_VERIFICATION_ATTEMPTS } from "../services/login-verification.gate";
import { signInHarness, type SignInHarness } from "./fakes/identity-sign-in.fakes";
import {
	FakeCredentialCrypto,
	FixedClock,
	InMemoryIdentityStore,
	NOW,
	RecordingFlowSubject,
	SequentialIds,
	TEST_DEVICE,
	TEST_SETTINGS,
	accountState,
	anonymousActor,
} from "./fakes/identity.fakes";

const DAY_MS = 86_400_000;

class FixedOperator implements OperatorIdentityPort {
	public current(): OperatorIdentity {
		return { osUser: "deploy", host: "bastion-1" };
	}
}

let store: InMemoryIdentityStore;
let clock: FixedClock;

beforeEach(() => {
	store = new InMemoryIdentityStore();
	clock = new FixedClock();
});

describe("BootstrapSuperAdminHandler", () => {
	const actor = systemActor("auth.superadmin.bootstrap", "cli", null, "bootstrap the first SuperAdmin", null);

	function bootstrap(email = "root@example.com"): ReturnType<BootstrapSuperAdminHandler["execute"]> {
		return new BootstrapSuperAdminHandler(store.uow, new FakeCredentialCrypto(), new SequentialIds("root"), new FixedOperator(), clock).execute(
			new BootstrapSuperAdminCommand(actor, { identity: { email, fullName: "Root Admin" }, password: "A-Long-Bootstrap-Password-1" }),
		);
	}

	it("creates a verified SuperAdmin under the bootstrap lock, with the role assignment audited as bootstrap", async () => {
		await expect(bootstrap()).resolves.toEqual({ userId: "root-1", email: "root@example.com", fullName: "Root Admin" });

		expect(store.accounts.bootstrapLocks).toBe(1);
		expect(store.accounts.rows.get("root-1")).toMatchObject({
			isSuperAdmin: true,
			emailVerifiedAt: NOW,
			mfaEnrollmentDeadline: NOW,
			passwordHash: "hash:A-Long-Bootstrap-Password-1",
		});
		expect(store.signupReferrals.firstCodes).toEqual(["root-1"]);
		const [assignment] = store.roles.provisioned;
		expect(assignment).toMatchObject({
			userId: "root-1",
			roleName: SUPER_ADMIN_ROLE_NAME,
			operation: "auth.superadmin.bootstrap",
			precedingAuditActions: ["SUPER_ADMIN_BOOTSTRAPPED"],
		});
		expect(assignment?.detail).toContain('"osUser":"deploy"');
	});

	it("refuses once a SuperAdmin exists, an address that is taken, and a catalog without the role", async () => {
		store.accounts.seed(accountState({ id: "user-1", email: EmailAddress.of("taken@example.com") }));
		await expect(bootstrap("taken@example.com")).rejects.toBeInstanceOf(BootstrapEmailTakenError);

		store.roles.missingRoles.add(SUPER_ADMIN_ROLE_NAME);
		await expect(bootstrap()).rejects.toBeInstanceOf(SuperAdminRoleMissingError);

		store.roles.missingRoles.clear();
		await bootstrap("first@example.com");
		await expect(bootstrap("second@example.com")).rejects.toBeInstanceOf(SuperAdminAlreadyExistsError);
	});
});

describe("PurgeStalePasswordResetTokensHandler", () => {
	it("retires links used past their retention, keeping open ones", async () => {
		const used = PasswordResetToken.issue({ id: "used", userId: "user-1", tokenHash: "h1", tokenDigest: "d1" }, epochMs(NOW - 10 * DAY_MS));
		used.consume(epochMs(NOW - 10 * DAY_MS));
		await store.resetTokens.add(used);
		await store.resetTokens.add(PasswordResetToken.issue({ id: "open", userId: "user-1", tokenHash: "h2", tokenDigest: "d2" }, NOW));
		const actor = systemActor("maintenance.password_reset_token_cleanup", "cron", null, "purge", null);

		await expect(new PurgeStalePasswordResetTokensHandler(store.uow, clock).execute(new PurgeStalePasswordResetTokensCommand(actor, { reason: "purge" }))).resolves.toBe(1);

		expect([...store.resetTokens.rows.keys()]).toEqual(["open"]);
		expect(USED_RESET_TOKEN_RETENTION_MS).toBeLessThan(10 * DAY_MS);
	});
});

describe("New-device login verification", () => {
	const EMAIL = "jane@example.com";
	let harness: SignInHarness;

	beforeEach(() => {
		harness = signInHarness(store, clock, { ...TEST_SETTINGS, loginVerificationMode: "always" });
		store.accounts.seed(accountState({ id: "user-1", email: EmailAddress.of(EMAIL) }));
	});

	async function pendingVerification(): Promise<string> {
		const handler = new LogInHandler(
			store.uow,
			harness.crypto,
			harness.tokens,
			harness.grants,
			new SequentialIds("challenge"),
			new RecordingFlowSubject(),
			clock,
			harness.gate,
		);
		const pending = await handler.execute(
			new LogInCommand(anonymousActor(), {
				body: { email: EMAIL, password: "Correct-Horse-1" },
				clientType: "web",
				device: { device: TEST_DEVICE, ipAddress: null, userAgent: "Firefox" },
			}),
		);
		if (!("verificationId" in pending)) {
			throw new Error("expected a pending login verification");
		}
		return pending.verificationId;
	}

	function verify(verificationId: string, code: string): ReturnType<VerifyNewDeviceLoginHandler["execute"]> {
		return new VerifyNewDeviceLoginHandler(harness.verifications, harness.crypto, harness.gate, harness.sessions).execute(
			new VerifyNewDeviceLoginCommand(anonymousActor(), { verificationId, code, device: { device: TEST_DEVICE, ipAddress: null, userAgent: "Firefox" } }),
		);
	}

	it("mails a code instead of a session, then issues the session for the right code and remembers the device", async () => {
		const verificationId = await pendingVerification();
		expect(store.emails.sent).toEqual([{ kind: "login_verification", to: EMAIL, detail: "777777" }]);
		expect(store.sessions.rows.size).toBe(0);

		await expect(verify(verificationId, "777777")).resolves.toMatchObject({ accessToken: "access:user-1:session-1:full" });

		expect(harness.verifications.challenges.has(verificationId)).toBe(false);
		expect(harness.verifications.recentlyVerified.has("user-1")).toBe(true);
		expect(store.sessions.rows.get("session-1")?.signInMethod).toBe("PASSWORD_NEW_DEVICE_CODE");
		await expect(verify(verificationId, "777777")).rejects.toBeInstanceOf(LoginVerificationExpiredError);
	});

	it("refuses a wrong code, and drops the challenge after the allowed attempts", async () => {
		const verificationId = await pendingVerification();

		for (let attempt = 0; attempt < MAX_LOGIN_VERIFICATION_ATTEMPTS; attempt += 1) {
			await expect(verify(verificationId, "000000")).rejects.toBeInstanceOf(InvalidLoginVerificationCodeError);
		}
		await expect(verify(verificationId, "777777")).rejects.toBeInstanceOf(LoginVerificationAttemptsExceededError);
		expect(harness.verifications.challenges.has(verificationId)).toBe(false);
	});
});
