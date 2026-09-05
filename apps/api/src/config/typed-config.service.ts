import { Injectable } from "@nestjs/common";

/**
 * Typed configuration service that reads environment variables.
 *
 * Provides strongly-typed access to all configuration values used across the app.
 * Values are read from `process.env` at runtime.
 */
@Injectable()
export class TypedConfigService {
	// ── JWT Configuration ──────────────────────────────────────────────

	/** Reads a secret from env; throws in production if missing. */
	private requireSecret(envKey: string, fallback: string): string {
		const value: string | undefined = process.env[envKey];
		if (value === undefined || value.length === 0) {
			if (process.env.NODE_ENV === "production") {
				throw new Error(`Missing required environment variable: ${envKey}. Set it in production — fallback defaults are not allowed.`);
			}
			return fallback;
		}
		return value;
	}

	/** Secret key for signing access tokens */
	public get jwtAccessSecret(): string {
		return this.requireSecret("JWT_ACCESS_SECRET", "access-secret-change-me");
	}

	/** Expiry duration for access tokens (e.g. "15m") */
	public get jwtAccessExpiry(): string {
		return process.env.JWT_ACCESS_EXPIRY ?? "15m";
	}

	/** Secret key for signing refresh tokens */
	public get jwtRefreshSecret(): string {
		return this.requireSecret("JWT_REFRESH_SECRET", "refresh-secret-change-me");
	}

	/** Expiry duration for refresh tokens (e.g. "7d") */
	public get jwtRefreshExpiry(): string {
		return process.env.JWT_REFRESH_EXPIRY ?? "7d";
	}

	/** Secret key for email verification tokens */
	public get emailVerificationSecret(): string {
		return this.requireSecret("EMAIL_VERIFICATION_SECRET", "email-verify-secret-change-me");
	}

	// ── Bcrypt Configuration ───────────────────────────────────────────

	/** Number of bcrypt salt rounds for password hashing */
	public get bcryptSaltRounds(): number {
		const value: string | undefined = process.env.BCRYPT_SALT_ROUNDS;
		return value ? Number.parseInt(value, 10) : 12;
	}

	// ── Resend (Email) Configuration ───────────────────────────────────

	/** Resend API key for sending transactional emails */
	public get resendApiKey(): string {
		return process.env.RESEND_API_KEY ?? "";
	}

	/** From address for outgoing emails (e.g. "noreply@example.com") */
	public get emailFromAddress(): string {
		return process.env.EMAIL_FROM_ADDRESS ?? "noreply@example.com";
	}

	/** Send mode: "send" (real Resend), "log-only" (print), or "noop" (skip). */
	public get emailMode(): "send" | "log-only" | "noop" {
		const value: string | undefined = process.env.EMAIL_MODE;
		return value === "log-only" || value === "noop" ? value : "send";
	}

	/** Dev-only override that redirects every send to a single inbox. */
	public get emailTestTo(): string | undefined {
		return process.env.EMAIL_TEST_TO;
	}

	/** Reply-to address appended to every outbound email. */
	public get emailReplyTo(): string | undefined {
		return process.env.EMAIL_REPLY_TO;
	}

	/** Max attempts per send (including the first try) — retry with backoff. */
	public get emailMaxAttempts(): number {
		const value: string | undefined = process.env.EMAIL_MAX_ATTEMPTS;
		const parsed: number = value ? Number.parseInt(value, 10) : 3;
		return parsed >= 1 && parsed <= 10 ? parsed : 3;
	}

	/** Per-send timeout in milliseconds. */
	public get emailTimeoutMs(): number {
		const value: string | undefined = process.env.EMAIL_TIMEOUT_MS;
		return value ? Number.parseInt(value, 10) : 10_000;
	}

	/** Per-recipient sends-per-minute cap; 0 disables rate limiting. */
	public get emailRateLimitPerMinute(): number {
		const value: string | undefined = process.env.EMAIL_RATE_LIMIT_PER_MINUTE;
		const parsed: number = value ? Number.parseInt(value, 10) : 0;
		return parsed >= 0 ? parsed : 0;
	}

	/** Secret used to verify Resend webhook signatures. */
	public get resendWebhookSecret(): string {
		return process.env.RESEND_WEBHOOK_SECRET ?? "";
	}

	/**
	 * Per-IP requests-per-minute cap on the public delivery-webhook endpoint;
	 * `0` disables the limiter. The endpoint is already signature-verified —
	 * this is defense-in-depth against hammering a public route.
	 */
	public get webhookRateLimitPerMinute(): number {
		const value: string | undefined = process.env.WEBHOOK_RATE_LIMIT_PER_MINUTE;
		const parsed: number = value ? Number.parseInt(value, 10) : 120;
		return parsed >= 0 ? parsed : 0;
	}

	// ── App Configuration ──────────────────────────────────────────────

	/** Application name (used in email templates) */
	public get appName(): string {
		return process.env.APP_NAME ?? "MyApp";
	}

	/** Public-facing application URL (used in email links) */
	public get appUrl(): string {
		return process.env.APP_URL ?? "http://localhost:3000";
	}

	/** Merchant portal URL for onboarding invite links (falls back to `APP_URL`). */
	public get merchantAppUrl(): string {
		const value = process.env.MERCHANT_APP_URL;
		return value !== undefined && value.length > 0 ? value : this.appUrl;
	}

	// ── Authorization cache ────────────────────────────────────────────

	/** TTL for authorization cache entries in milliseconds (default 5 minutes). */
	public get authorizationCacheTtlMs(): number {
		const value: string | undefined = process.env.AUTHORIZATION_CACHE_TTL_MS;
		const parsed: number = value ? Number.parseInt(value, 10) : 5 * 60 * 1000;
		return parsed > 0 ? parsed : 5 * 60 * 1000;
	}

	/**
	 * Authorization cache backend.
	 * - `memory` — local Map only (default for development).
	 * - `redis` — local Map + Redis pub/sub invalidation (deployed environments).
	 * - `auto` — redis when `REDIS_URL` is set and `NODE_ENV !== development`.
	 */
	public get authorizationCacheBackend(): "memory" | "redis" {
		const explicit: string | undefined = process.env.AUTHORIZATION_CACHE_BACKEND;
		if (explicit === "memory") {
			return "memory";
		}
		if (explicit === "redis") {
			return "redis";
		}
		if (process.env.NODE_ENV !== "development" && this.redisUrl !== undefined) {
			return "redis";
		}
		return "memory";
	}

	public get useRedisAuthorizationCache(): boolean {
		return this.authorizationCacheBackend === "redis" && this.redisUrl !== undefined;
	}

	// ── User session cache (`/auth/me`, `/auth/permissions`) ───────────

	/** TTL for user session cache entries in milliseconds (default 30 minutes). */
	public get userSessionCacheTtlMs(): number {
		const value: string | undefined = process.env.USER_SESSION_CACHE_TTL_MS;
		const parsed: number = value ? Number.parseInt(value, 10) : 30 * 60 * 1000;
		return parsed > 0 ? parsed : 30 * 60 * 1000;
	}

	/**
	 * User session cache backend (login profile + permissions).
	 * Mirrors {@link authorizationCacheBackend}: `redis` when `REDIS_URL` is set outside development.
	 */
	public get userSessionCacheBackend(): "memory" | "redis" {
		const explicit: string | undefined = process.env.USER_SESSION_CACHE_BACKEND;
		if (explicit === "memory") {
			return "memory";
		}
		if (explicit === "redis") {
			return "redis";
		}
		if (process.env.NODE_ENV !== "development" && this.redisUrl !== undefined) {
			return "redis";
		}
		return "memory";
	}

	public get useRedisUserSessionCache(): boolean {
		return this.userSessionCacheBackend === "redis" && this.redisUrl !== undefined;
	}

	/** Redis connection URL for distributed authorization cache invalidation and BullMQ job queues. */
	public get redisUrl(): string | undefined {
		const value: string | undefined = process.env.REDIS_URL;
		return value !== undefined && value.length > 0 ? value : undefined;
	}

	/** Whether BullMQ workers and producers should be active. */
	public get useBullMq(): boolean {
		return this.redisUrl !== undefined;
	}

	// ── Kafka ──────────────────────────────────────────────────────────────

	/** Kafka bootstrap servers (comma-separated). */
	public get kafkaBrokers(): readonly string[] | undefined {
		const value: string | undefined = process.env.KAFKA_BROKERS;
		if (value === undefined || value.length === 0) {
			return undefined;
		}
		const brokers: string[] = value
			.split(",")
			.map((broker: string): string => broker.trim())
			.filter((broker: string): boolean => broker.length > 0);
		return brokers.length > 0 ? brokers : undefined;
	}

	/** Whether the Kafka producer and event bridge should be active. */
	public get useKafka(): boolean {
		return this.kafkaBrokers !== undefined;
	}
}
