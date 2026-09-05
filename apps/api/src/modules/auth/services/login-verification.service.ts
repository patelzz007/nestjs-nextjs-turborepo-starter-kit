import { BadRequestException, Inject, Injectable, TooManyRequestsException, UnauthorizedException } from "@nestjs/common";
import type Redis from "ioredis";
import type { LoginServiceResponse, LoginVerificationPendingResponse } from "@workspace/shared";

import { z } from "zod";

import { TypedConfigService } from "../../../config/typed-config.service";
import { REDIS_PUBLISHER } from "../../../infrastructure/redis/redis.tokens";
import { LogService } from "../../../modules/logs/logs.service";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuthSessionService } from "./auth-session.service";
import { CryptoService } from "./crypto.service";
import { EmailService } from "./email.service";

const VERIFICATION_TTL_SECONDS = 600;
const RECOGNIZED_DEVICE_TTL_SECONDS = 7 * 24 * 60 * 60;
const LAST_VERIFIED_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_VERIFY_ATTEMPTS = 5;

const LoginVerificationRecordSchema = z
	.object({
		userId: z.string().min(1),
		codeHash: z.string().min(1),
		clientType: z.string().nullable(),
		deviceInfo: z.string().nullable(),
		ipAddress: z.string().nullable(),
		attempts: z.number().int().nonnegative(),
	})
	.strict();

type LoginVerificationRecord = z.output<typeof LoginVerificationRecordSchema>;

interface PendingLoginContext {
	readonly userId: string;
	readonly clientType: string | null;
	readonly deviceInfo: string | null;
	readonly ipAddress: string | null;
}

@Injectable()
export class LoginVerificationService {
	private readonly memoryStore: Map<string, { readonly value: string; readonly expiresAt: number }> = new Map();

	public constructor(
		private readonly prisma: PrismaService,
		private readonly cryptoService: CryptoService,
		private readonly emailService: EmailService,
		private readonly authSessionService: AuthSessionService,
		private readonly config: TypedConfigService,
		private readonly logService: LogService,
		@Inject(REDIS_PUBLISHER) private readonly redis: Redis | null,
	) {}

	public async maybeRequireVerification(context: PendingLoginContext): Promise<LoginServiceResponse | LoginVerificationPendingResponse> {
		const needsVerification = await this.needsVerification(context.userId, context.deviceInfo);
		if (!needsVerification) {
			return this.authSessionService.issueSessionForUser(context.userId, context.clientType ?? undefined, context.deviceInfo ?? undefined, context.ipAddress ?? undefined);
		}

		return this.createVerificationChallenge(context);
	}

	public async verifyLoginCode(verificationId: string, code: string, ipAddress?: string): Promise<LoginServiceResponse> {
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
			throw new TooManyRequestsException("Too many verification attempts");
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
			metadata: { verificationId, ipAddress: ipAddress ?? "Unknown" },
		});

		return this.authSessionService.issueSessionForUser(record.userId, record.clientType ?? undefined, record.deviceInfo ?? undefined, record.ipAddress ?? undefined);
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
			attempts: 0,
		};

		await this.setStoreValue(this.verificationKey(verificationId), JSON.stringify(record), VERIFICATION_TTL_SECONDS);
		const emailResult = await this.emailService.sendLoginVerificationEmail(
			user.email,
			verificationCode,
			context.deviceInfo ?? "Unknown device",
			context.ipAddress ?? "Unknown IP",
		);

		if (process.env.NODE_ENV !== "production") {
			this.logService.info("Login verification OTP (dev only — use this code, not your authenticator app)", {
				userId: context.userId,
				context: "LoginVerificationService",
				metadata: { verificationId, code: verificationCode },
			});
		}

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
		if (this.config.forceLoginVerification) {
			return true;
		}

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
		return `login_verify:${verificationId}`;
	}

	private recognizedDeviceKey(userId: string, deviceHash: string): string {
		return `recognized_device:${userId}:${deviceHash}`;
	}

	private lastVerifiedKey(userId: string): string {
		return `last_verified:${userId}`;
	}

	private async getStoreValue(key: string): Promise<string | null> {
		if (this.redis !== null && this.redis.status === "ready") {
			return this.redis.get(key);
		}

		const entry = this.memoryStore.get(key);
		if (entry === undefined || entry.expiresAt <= Date.now()) {
			this.memoryStore.delete(key);
			return null;
		}

		return entry.value;
	}

	private async setStoreValue(key: string, value: string, ttlSeconds: number): Promise<void> {
		if (this.redis !== null && this.redis.status === "ready") {
			await this.redis.setex(key, ttlSeconds, value);
			return;
		}

		this.memoryStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
	}

	private async deleteStoreValue(key: string): Promise<void> {
		if (this.redis !== null && this.redis.status === "ready") {
			await this.redis.del(key);
		}
		this.memoryStore.delete(key);
	}
}
