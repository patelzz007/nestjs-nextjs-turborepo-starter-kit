import { Test } from "@nestjs/testing";
import { epochMs, type LoginServiceResponse, type SessionSignInMethod } from "@workspace/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TypedConfigService } from "../../../config/typed-config.service";
import { LogService } from "../../logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { REDIS_PUBLISHER } from "../../../infrastructure/redis/redis.tokens";
import type { SessionDeviceContext } from "../../sessions/device/session-device";
import { AuthSessionService } from "./auth-session.service";
import { CryptoService } from "./crypto.service";
import { EmailService } from "./email.service";
import { LoginVerificationService, type PendingLoginContext, type PendingSignInMethod } from "./login-verification.service";
import { createTestTypedConfig, type TestEnv } from "../../../../test/support/test-api-env";

const mocks = vi.hoisted(() => ({
	findUnique: vi.fn(),
	issueSessionForUser: vi.fn(),
	sendLoginVerificationEmail: vi.fn(),
	logInfo: vi.fn(),
	logWarn: vi.fn(),
}));

/** The issued session the stubbed `AuthSessionService` returns when no verification is needed. */
const ISSUED_SESSION: LoginServiceResponse = {
	user: {
		id: "user-1",
		email: "user@example.com",
		fullName: "Test User",
		isActive: true,
		isSuperAdmin: false,
		isEmailVerified: true,
		twoFactorEnabled: false,
		hasAdminAccess: false,
		tokenVersion: 0,
		roles: [],
		createdAt: epochMs(0),
		updatedAt: epochMs(0),
		isDeleted: false,
		deletedAt: null,
	},
	accessToken: "access",
	refreshToken: "refresh",
};

/** The request continuing the login (and receiving the session). */
const DEVICE: SessionDeviceContext = {
	device: {
		clientType: "web",
		browserName: "Firefox",
		browserVersion: "142.0",
		osName: "macOS",
		osVersion: "16.1",
		deviceType: "DESKTOP",
		deviceModel: null,
		deviceName: null,
		appVersion: null,
	},
	ipAddress: "198.18.0.1",
	userAgent: "Firefox on macOS",
};

const LOGIN_CONTEXT: PendingLoginContext = {
	userId: "user-1",
	clientType: "web",
	deviceInfo: "Firefox on macOS",
	ipAddress: "198.18.0.1",
	signInMethod: "PASSWORD_TOTP",
	device: DEVICE,
};

/** The one-time code the stubbed crypto service generates. */
const GENERATED_CODE = "123456";

async function createService(env: TestEnv): Promise<LoginVerificationService> {
	const moduleRef = await Test.createTestingModule({
		providers: [
			LoginVerificationService,
			{ provide: PrismaService, useValue: { user: { findUnique: mocks.findUnique } } },
			{
				provide: CryptoService,
				useValue: {
					generateNumericCode: (): string => GENERATED_CODE,
					generateRandomToken: (): string => "verification-1",
					hash: async (value: string): Promise<string> => Promise.resolve(`hashed:${value}`),
					compare: async (value: string, hash: string): Promise<boolean> => Promise.resolve(hash === `hashed:${value}`),
				},
			},
			{ provide: EmailService, useValue: { sendLoginVerificationEmail: mocks.sendLoginVerificationEmail } },
			{ provide: AuthSessionService, useValue: { issueSessionForUser: mocks.issueSessionForUser } },
			{ provide: TypedConfigService, useValue: createTestTypedConfig(env) },
			{ provide: LogService, useValue: { info: mocks.logInfo, warn: mocks.logWarn } },
			{ provide: REDIS_PUBLISHER, useValue: null },
		],
	})
		.useMocker((token) => {
			throw new Error(`Unexpected dependency ${String(token)}`);
		})
		.compile();
	return moduleRef.get(LoginVerificationService);
}

describe("LoginVerificationService", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.findUnique.mockResolvedValue({ email: "user@example.com", fullName: "Test User" });
		mocks.issueSessionForUser.mockResolvedValue(ISSUED_SESSION);
		mocks.sendLoginVerificationEmail.mockResolvedValue({ ok: true, mode: "send", messageId: "msg-1" });
	});

	it("verifies a login from an unrecognized device in new-device mode, also when NODE_ENV=test", async () => {
		const service = await createService({ LOGIN_VERIFICATION_MODE: "new-device" });

		const result = await service.maybeRequireVerification(LOGIN_CONTEXT);

		expect(result).toEqual({ requiresVerification: true, verificationId: "verification-1", message: "Verification code sent to your email" });
		expect(mocks.sendLoginVerificationEmail).toHaveBeenCalledWith("user@example.com", GENERATED_CODE, LOGIN_CONTEXT.deviceInfo, LOGIN_CONTEXT.ipAddress);
		expect(mocks.issueSessionForUser).not.toHaveBeenCalled();
	});

	it("recognizes the device after a successful verification in new-device mode", async () => {
		const service = await createService({ LOGIN_VERIFICATION_MODE: "new-device" });
		await service.maybeRequireVerification(LOGIN_CONTEXT);

		await expect(service.verifyLoginCode("verification-1", GENERATED_CODE, DEVICE)).resolves.toEqual(ISSUED_SESSION);
		await expect(service.maybeRequireVerification(LOGIN_CONTEXT)).resolves.toEqual(ISSUED_SESSION);
	});

	it("requires the code on every login in always mode", async () => {
		const service = await createService({ LOGIN_VERIFICATION_MODE: "always" });
		await service.maybeRequireVerification(LOGIN_CONTEXT);
		await service.verifyLoginCode("verification-1", GENERATED_CODE, DEVICE);

		await expect(service.maybeRequireVerification(LOGIN_CONTEXT)).resolves.toMatchObject({ requiresVerification: true });
	});

	it("issues the session directly only when verification is explicitly disabled", async () => {
		const service = await createService({ LOGIN_VERIFICATION_MODE: "disabled" });

		await expect(service.maybeRequireVerification(LOGIN_CONTEXT)).resolves.toEqual(ISSUED_SESSION);
		expect(mocks.sendLoginVerificationEmail).not.toHaveBeenCalled();
		// The session is stored for the continuing request, with the proofs collected so far.
		expect(mocks.issueSessionForUser).toHaveBeenCalledWith("user-1", "web", { device: DEVICE, signInMethod: "PASSWORD_TOTP" }, { mfaAssured: undefined });
	});

	it.each([
		["PASSWORD", "PASSWORD_NEW_DEVICE_CODE"],
		["PASSWORD_TOTP", "PASSWORD_TOTP_NEW_DEVICE_CODE"],
		["PASSWORD_BACKUP_CODE", "PASSWORD_BACKUP_CODE_NEW_DEVICE_CODE"],
		["TEAM_INVITE_REGISTRATION", "TEAM_INVITE_REGISTRATION_NEW_DEVICE_CODE"],
	] satisfies [PendingSignInMethod, SessionSignInMethod][])(
		"records %s completed by the emailed code as %s, for the device presenting the code",
		async (pending, completed) => {
			const service = await createService({ LOGIN_VERIFICATION_MODE: "always" });
			await service.maybeRequireVerification({ ...LOGIN_CONTEXT, signInMethod: pending });
			const codeDevice: SessionDeviceContext = { ...DEVICE, ipAddress: "203.0.113.9" };

			await service.verifyLoginCode("verification-1", GENERATED_CODE, codeDevice);

			expect(mocks.issueSessionForUser).toHaveBeenCalledWith("user-1", "web", { device: codeDevice, signInMethod: completed });
		},
	);

	it("never writes the one-time code to the log", async () => {
		const service = await createService({ LOGIN_VERIFICATION_MODE: "always", NODE_ENV: "development" });

		await service.maybeRequireVerification(LOGIN_CONTEXT);

		const logged: string = JSON.stringify([...mocks.logInfo.mock.calls, ...mocks.logWarn.mock.calls]);
		expect(logged).not.toContain(GENERATED_CODE);
	});
});
