import { BadRequestException, HttpException, HttpStatus, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type Redis from "ioredis";
import {
	assertNever,
	BoundedTtlCache,
	SessionSignInMethodSchema,
	type LoginRestrictedEnrollmentResponse,
	type LoginServiceResponse,
	type LoginVerificationPendingResponse,
	type SessionSignInMethod,
} from "@workspace/shared";

import { z } from "zod";

import type { LoginVerificationMode } from "../../../config/api-env.fields";
import { TypedConfigService } from "../../../config/typed-config.service";
import { REDIS_PUBLISHER } from "../../../infrastructure/redis/redis.tokens";
import { LogService } from "../../../modules/logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import type { SessionDeviceContext } from "../../sessions/device/session-device";
import { AuthSessionService } from "./auth-session.service";
import { CryptoService } from "./crypto.service";
import { EmailService } from "./email.service";

const VERIFICATION_TTL_SECONDS = 600;
const RECOGNIZED_DEVICE_TTL_SECONDS = 7 * 24 * 60 * 60;
const LAST_VERIFIED_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_VERIFY_ATTEMPTS = 5;

/**
 * The proofs a login flow collected BEFORE login verification: the sign-in
 * method of a session issued right away. The emailed new-device code, when
 * asked for, upgrades it ({@link SIGN_IN_METHOD_WITH_NEW_DEVICE_CODE}).
 */
export const PendingSignInMethodSchema = SessionSignInMethodSchema.extract(["PASSWORD", "PASSWORD_TOTP", "PASSWORD_BACKUP_CODE", "TEAM_INVITE_REGISTRATION"]);

export type PendingSignInMethod = z.output<typeof PendingSignInMethodSchema>;

/** The sign-in method of a session issued after the emailed new-device code. */
export const SIGN_IN_METHOD_WITH_NEW_DEVICE_CODE: Readonly<Record<PendingSignInMethod, SessionSignInMethod>> = {
	PASSWORD: "PASSWORD_NEW_DEVICE_CODE",
	PASSWORD_TOTP: "PASSWORD_TOTP_NEW_DEVICE_CODE",
	PASSWORD_BACKUP_CODE: "PASSWORD_BACKUP_CODE_NEW_DEVICE_CODE",
	TEAM_INVITE_REGISTRATION: "TEAM_INVITE_REGISTRATION_NEW_DEVICE_CODE",
};

const LoginVerificationRecordSchema = z
	.object({
		userId: z.string().min(1),
		codeHash: z.string().min(1),
		clientType: z.string().nullable(),
		deviceInfo: z.string().nullable(),
		ipAddress: z.string().nullable(),
		signInMethod: PendingSignInMethodSchema,
		attempts: z.number().int().nonnegative(),
	})
	.strict();

type LoginVerificationRecord = z.output<typeof LoginVerificationRecordSchema>;

export interface PendingLoginContext {
	readonly userId: string;
	readonly clientType: string | null;
	/** The User-Agent of the request that started the login (new-device recognition, the verification email). */
	readonly deviceInfo: string | null;
	/** The IP of the request that started the login (the verification email). */
	readonly ipAddress: string | null;
	/** The proofs the flow collected so far. */
	readonly signInMethod: PendingSignInMethod;
	/** The request continuing the login: the device a session issued now is stored for. */
	readonly device: SessionDeviceContext;
	readonly mfaAssured?: boolean;
}

@Injectable()
export class LoginVerificationService {
	private readonly memoryStore: BoundedTtlCache<string, string>;

	public constructor(
		private readonly prisma: PrismaService,
		private readonly cryptoService: CryptoService,
		private readonly emailService: EmailService,
		private readonly authSessionService: AuthSessionService,
		private readonly config: TypedConfigService,
		private readonly logService: LogService,
		@Inject(REDIS_PUBLISHER) private readonly redis: Redis | null,
	) {
		this.memoryStore = new BoundedTtlCache<string, string>({
			maxEntries: config.rateLimits.securityCounterMaxKeys,
			capacityPolicy: "evict-oldest",
		});
	}

	public async maybeRequireVerification(context: PendingLoginContext): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse | LoginVerificationPendingResponse> {
		const needsVerification = await this.needsVerification(context.userId, context.deviceInfo);
		if (!needsVerification) {
			return this.authSessionService.issueSessionForUser(
				context.userId,
				context.clientType ?? undefined,
				{ device: context.device, signInMethod: context.signInMethod },
				{ mfaAssured: context.mfaAssured },
			);
		}

		return this.createVerificationChallenge(context);
	}

	/** Completes a login with the emailed code; the session is stored for `device`, the request presenting the code. */
	public async verifyLoginCode(verificationId: string, code: string, device: SessionDeviceContext): Promise<LoginServiceResponse | LoginRestrictedEnrollmentResponse> {
		const raw = await this.getStoreValue(this.verificationKey(verificationId));
		if (raw === null) {
			throw new BadRequestException("Verification session expired or invalid");
		}

		const parsed = LoginVerificationRecordSchema.safeParse(JSON.parse(raw));
		if (!parsed.success) {
			await this.deleteStoreValue(this.verificationKey(verificationId));
			throw new BadRequestException("Verification session expired or invalid");
		}

		const record: LoginVerificationRecord = parsed.data;
		if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
			await this.deleteStoreValue(this.verificationKey(verificationId));
			throw new HttpException("Too many verification attempts", HttpStatus.TOO_MANY_REQUESTS);
		}

		const codeValid = await this.cryptoService.compare(code, record.codeHash);
		if (!codeValid) {
			const updated: LoginVerificationRecord = { ...record, attempts: record.attempts + 1 };
			await this.setStoreValue(this.verificationKey(verificationId), JSON.stringify(updated), VERIFICATION_TTL_SECONDS);
			throw new UnauthorizedException("Invalid verification code");
		}

		await this.deleteStoreValue(this.verificationKey(verificationId));
		await this.markDeviceRecognized(record.userId, record.deviceInfo);
		await this.setLastVerified(record.userId);

		this.logService.info("Login verification succeeded", {
			userId: record.userId,
			context: "LoginVerificationService",
			metadata: { verificationId, ipAddress: device.ipAddress ?? "Unknown" },
		});

		return this.authSessionService.issueSessionForUser(record.userId, record.clientType ?? undefined, {
			device,
			signInMethod: SIGN_IN_METHOD_WITH_NEW_DEVICE_CODE[record.signInMethod],
		});
	}

	private async createVerificationChallenge(context: PendingLoginContext): Promise<LoginVerificationPendingResponse> {
		const user = await this.prisma.user.findUnique({
			where: { id: context.userId },
			select: { email: true, fullName: true },
		});

		if (user === null) {
			throw new UnauthorizedException("Invalid verification session");
		}

		const verificationCode = this.cryptoService.generateNumericCode(6);
		const codeHash = await this.cryptoService.hash(verificationCode);
		const verificationId = this.cryptoService.generateRandomToken();

		const record: LoginVerificationRecord = {
			userId: context.userId,
			codeHash,
			clientType: context.clientType,
			deviceInfo: context.deviceInfo,
			ipAddress: context.ipAddress,
			signInMethod: context.signInMethod,
			attempts: 0,
		};

		await this.setStoreValue(this.verificationKey(verificationId), JSON.stringify(record), VERIFICATION_TTL_SECONDS);
		const emailResult = await this.emailService.sendLoginVerificationEmail(
			user.email,
			verificationCode,
			context.deviceInfo ?? "Unknown device",
			context.ipAddress ?? "Unknown IP",
		);

		if (!emailResult.ok) {
			this.logService.warn("Login verification email delivery failed", {
				userId: context.userId,
				context: "LoginVerificationService",
				metadata: { reason: emailResult.reason, detail: emailResult.detail ?? null },
			});
		} else {
			this.logService.info("Login verification email dispatched", {
				userId: context.userId,
				context: "LoginVerificationService",
				metadata: { verificationId, mode: emailResult.mode },
			});
		}

		this.logService.info("Login verification challenge created", {
			userId: context.userId,
			context: "LoginVerificationService",
			metadata: { verificationId },
		});

		return {
			requiresVerification: true,
			verificationId,
			message: "Verification code sent to your email",
		};
	}

	private async needsVerification(userId: string, deviceInfo: string | null): Promise<boolean> {
		const mode: LoginVerificationMode = this.config.auth.loginVerificationMode;
		switch (mode) {
			case "disabled":
				return false;
			case "always":
				return true;
			case "new-device":
				return this.isUnrecognizedDevice(userId, deviceInfo);
			default:
				return assertNever(mode, "login verification mode");
		}
	}

	/** `new-device` mode: verify unless this user verified recently or from this device. */
	private async isUnrecognizedDevice(userId: string, deviceInfo: string | null): Promise<boolean> {
		const lastVerified = await this.getStoreValue(this.lastVerifiedKey(userId));
		if (lastVerified !== null) {
			return false;
		}

		const deviceHash = this.buildDeviceHash(deviceInfo);
		const recognized = await this.getStoreValue(this.recognizedDeviceKey(userId, deviceHash));
		if (recognized !== null) {
			return false;
		}

		return true;
	}

	private async markDeviceRecognized(userId: string, deviceInfo: string | null): Promise<void> {
		const deviceHash = this.buildDeviceHash(deviceInfo);
		await this.setStoreValue(this.recognizedDeviceKey(userId, deviceHash), "1", RECOGNIZED_DEVICE_TTL_SECONDS);
	}

	private async setLastVerified(userId: string): Promise<void> {
		await this.setStoreValue(this.lastVerifiedKey(userId), String(Date.now()), LAST_VERIFIED_TTL_SECONDS);
	}

	private buildDeviceHash(deviceInfo: string | null): string {
		return deviceInfo ?? "unknown-device";
	}

	private verificationKey(verificationId: string): string {
		return this.config.redisNamespace.key(`login_verify:${verificationId}`);
	}

	private recognizedDeviceKey(userId: string, deviceHash: string): string {
		return this.config.redisNamespace.key(`recognized_device:${userId}:${deviceHash}`);
	}

	private lastVerifiedKey(userId: string): string {
		return this.config.redisNamespace.key(`last_verified:${userId}`);
	}

	private async getStoreValue(key: string): Promise<string | null> {
		if (this.redis !== null && this.redis.status === "ready") {
			return this.redis.get(key);
		}

		return this.memoryStore.get(key);
	}

	private async setStoreValue(key: string, value: string, ttlSeconds: number): Promise<void> {
		if (this.redis !== null && this.redis.status === "ready") {
			await this.redis.setex(key, ttlSeconds, value);
			return;
		}

		this.memoryStore.set(key, value, ttlSeconds * 1000);
	}

	private async deleteStoreValue(key: string): Promise<void> {
		if (this.redis !== null && this.redis.status === "ready") {
			await this.redis.del(key);
		}
		this.memoryStore.delete(key);
	}
}
