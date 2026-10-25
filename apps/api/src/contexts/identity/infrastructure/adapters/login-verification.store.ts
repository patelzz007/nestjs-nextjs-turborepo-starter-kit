import { Inject, Injectable } from "@nestjs/common";
import { BoundedTtlCache } from "@workspace/shared";
import type Redis from "ioredis";
import { z } from "zod";

import { TypedConfigService } from "../../../../config/typed-config.service";
import { REDIS_PUBLISHER } from "../../../../platform/infrastructure/redis/redis.tokens";
import type { LoginVerificationRecord, LoginVerificationStorePort } from "../../application/ports/login-verification-store.port";
import { PendingSignInMethodSchema } from "../../application/services/pending-sign-in";

const LoginVerificationRecordSchema = z
	.object({
		userId: z.string().min(1),
		codeHash: z.string().min(1),
		clientType: z.string().nullable(),
		deviceInfo: z.string().nullable(),
		ipAddress: z.string().nullable(),
		signInMethod: PendingSignInMethodSchema,
	})
	.strip();

/** The value stored for a "this is known" key. */
const PRESENT = "1";

/** `INCR` answers the new count as an integer reply. */
const IncrementResultSchema = z.number().int().positive();

/** The `[error, reply]` pair of the `INCR` inside the `MULTI`. */
const MultiIncrementSchema = z.tuple([z.tuple([z.null(), IncrementResultSchema]), z.tuple([z.null(), z.number()])]);

/**
 * New-device login verification state in Redis, or in a bounded in-memory map when Redis is not
 * ready (single-instance by configuration). D20: the attempt counter is its own key, incremented
 * with `INCR` + `PEXPIRE` in one `MULTI`; the in-memory fallback increments synchronously (no
 * read-then-write window between two requests on one instance).
 */
@Injectable()
export class LoginVerificationStore implements LoginVerificationStorePort {
	private readonly memory: BoundedTtlCache<string, string>;

	public constructor(
		private readonly config: TypedConfigService,
		@Inject(REDIS_PUBLISHER) private readonly redis: Redis | null,
	) {
		this.memory = new BoundedTtlCache<string, string>({ maxEntries: config.rateLimits.securityCounterMaxKeys, capacityPolicy: "evict-oldest" });
	}

	public async saveChallenge(verificationId: string, record: LoginVerificationRecord, ttlMs: number): Promise<void> {
		await this.set(this.challengeKey(verificationId), JSON.stringify(record), ttlMs);
	}

	public async findChallenge(verificationId: string): Promise<LoginVerificationRecord | null | "corrupt"> {
		const raw: string | null = await this.get(this.challengeKey(verificationId));
		if (raw === null) {
			return null;
		}
		try {
			const parsed = LoginVerificationRecordSchema.safeParse(JSON.parse(raw));
			return parsed.success ? parsed.data : "corrupt";
		} catch {
			return "corrupt";
		}
	}

	public async deleteChallenge(verificationId: string): Promise<void> {
		await this.delete(this.challengeKey(verificationId));
		await this.delete(this.attemptsKey(verificationId));
	}

	public async incrementAttempts(verificationId: string, ttlMs: number): Promise<number> {
		const key: string = this.attemptsKey(verificationId);
		if (this.redisReady(this.redis)) {
			const replies = await this.redis.multi().incr(key).pexpire(key, ttlMs).exec();
			const [[, count]] = MultiIncrementSchema.parse(replies);
			return count;
		}
		// Synchronous read-modify-write: nothing can interleave on this instance's event loop.
		const next: number = Number(this.memory.get(key) ?? "0") + 1;
		this.memory.set(key, String(next), ttlMs);
		return next;
	}

	public async markDeviceRecognized(userId: string, deviceKey: string, ttlMs: number): Promise<void> {
		await this.set(this.recognizedDeviceKey(userId, deviceKey), PRESENT, ttlMs);
	}

	public async isDeviceRecognized(userId: string, deviceKey: string): Promise<boolean> {
		return (await this.get(this.recognizedDeviceKey(userId, deviceKey))) !== null;
	}

	public async markRecentlyVerified(userId: string, verifiedAt: number, ttlMs: number): Promise<void> {
		await this.set(this.lastVerifiedKey(userId), String(verifiedAt), ttlMs);
	}

	public async wasRecentlyVerified(userId: string): Promise<boolean> {
		return (await this.get(this.lastVerifiedKey(userId))) !== null;
	}

	private redisReady(redis: Redis | null): redis is Redis {
		return redis?.status === "ready";
	}

	private challengeKey(verificationId: string): string {
		return this.config.redisNamespace.key(`login_verify:${verificationId}`);
	}

	private attemptsKey(verificationId: string): string {
		return this.config.redisNamespace.key(`login_verify_attempts:${verificationId}`);
	}

	private recognizedDeviceKey(userId: string, deviceKey: string): string {
		return this.config.redisNamespace.key(`recognized_device:${userId}:${deviceKey}`);
	}

	private lastVerifiedKey(userId: string): string {
		return this.config.redisNamespace.key(`last_verified:${userId}`);
	}

	private async get(key: string): Promise<string | null> {
		if (this.redisReady(this.redis)) {
			return this.redis.get(key);
		}
		return this.memory.get(key);
	}

	private async set(key: string, value: string, ttlMs: number): Promise<void> {
		if (this.redisReady(this.redis)) {
			await this.redis.set(key, value, "PX", ttlMs);
			return;
		}
		this.memory.set(key, value, ttlMs);
	}

	private async delete(key: string): Promise<void> {
		if (this.redisReady(this.redis)) {
			await this.redis.del(key);
		}
		this.memory.delete(key);
	}
}
