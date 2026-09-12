import * as crypto from "crypto";

import { Injectable } from "@nestjs/common";
import { MfaEncryptionKeysSchema } from "@workspace/shared";

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

	/** Secret key for short-lived 2FA login step tokens */
	public get twoFactorPendingSecret(): string {
		return this.requireSecret("TWO_FACTOR_PENDING_SECRET", "two-factor-pending-secret-change-me");
	}

	/** When true, every login requires the email OTP step (ignores trusted-device cache). */
	public get forceLoginVerification(): boolean {
		return process.env.FORCE_LOGIN_VERIFICATION === "true";
	}

	/** Issuer name shown in authenticator apps */
	public get twoFactorIssuer(): string {
		return process.env.TWO_FACTOR_ISSUER ?? this.appName;
	}

	// ── MFA hardening ──────────────────────────────────────────────────

	/** Versioned AES key material for MFA secret encryption (`MFA_ENCRYPTION_KEYS` JSON). */
	public get mfaEncryptionKeys(): Readonly<Record<number, string>> {
		const raw: string | undefined = process.env.MFA_ENCRYPTION_KEYS;
		if (raw === undefined || raw.length === 0) {
			if (process.env.NODE_ENV === "production") {
				throw new Error("Missing required environment variable: MFA_ENCRYPTION_KEYS. Set it in production — fallback defaults are not allowed.");
			}
			return { 1: crypto.createHash("sha256").update("dev-mfa-encryption-key-v1").digest("base64") };
		}

		let parsedKeys: ReturnType<typeof MfaEncryptionKeysSchema.safeParse>;
		try {
			parsedKeys = MfaEncryptionKeysSchema.safeParse(JSON.parse(raw));
		} catch {
			throw new Error("MFA_ENCRYPTION_KEYS must be valid JSON mapping version numbers to key material.");
		}
		if (!parsedKeys.success) {
			throw new Error("MFA_ENCRYPTION_KEYS must be valid JSON mapping version numbers to key material.");
		}

		const keys: Record<number, string> = {};
		for (const [versionKey, keyMaterial] of Object.entries(parsedKeys.data)) {
			const version: number = Number.parseInt(versionKey, 10);
			if (Number.isNaN(version) || version < 1) {
				throw new Error(`Invalid MFA encryption key version: ${versionKey}`);
			}
			keys[version] = keyMaterial;
		}

		if (Object.keys(keys).length === 0) {
			throw new Error("MFA_ENCRYPTION_KEYS must contain at least one key version.");
		}

		return keys;
	}

	/** Grace period before MFA enrollment is required (default 30 days). */
	public get mfaEnrollmentDeadlineMs(): number {
		const value: string | undefined = process.env.MFA_ENROLLMENT_DEADLINE_MS;
		const parsed: number = value ? Number.parseInt(value, 10) : 30 * 24 * 60 * 60 * 1000;
		return parsed > 0 ? parsed : 30 * 24 * 60 * 60 * 1000;
	}

	/** Delay after recovery approval before MFA is unlocked (default 24 hours). */
	public get mfaRecoveryDelayMs(): number {
		const value: string | undefined = process.env.MFA_RECOVERY_DELAY_MS;
		const parsed: number = value ? Number.parseInt(value, 10) : 24 * 60 * 60 * 1000;
		return parsed > 0 ? parsed : 24 * 60 * 60 * 1000;
	}

	/** TTL for step-up MFA assurance after verification (default 5 minutes). */
	public get mfaStepUpTtlMs(): number {
		const value: string | undefined = process.env.MFA_STEP_UP_TTL_MS;
		const parsed: number = value ? Number.parseInt(value, 10) : 5 * 60 * 1000;
		return parsed > 0 ? parsed : 5 * 60 * 1000;
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

	/** Public-facing web app URL (used in email links) */
	public get appUrl(): string {
		return process.env.APP_URL ?? "http://localhost:3000";
	}

	/** Admin panel URL for admin-specific email links (falls back to `APP_URL`). */
	public get adminAppUrl(): string {
		const value: string | undefined = process.env.ADMIN_APP_URL;
		return value !== undefined && value.length > 0 ? value : "http://localhost:3001";
	}

	/** Merchant portal URL for onboarding invite links (falls back to `APP_URL`). */
	public get merchantAppUrl(): string {
		const value = process.env.MERCHANT_APP_URL;
		return value !== undefined && value.length > 0 ? value : "http://localhost:3003";
	}

	/** Resolve the frontend base URL for a given auth client type. */
	public resolveClientAppUrl(clientType: string | undefined): string {
		if (clientType === "admin") {
			return this.adminAppUrl;
		}
		if (clientType === "merchant") {
			return this.merchantAppUrl;
		}
		return this.appUrl;
	}

	// ── Authorization cache ────────────────────────────────────────────

	/** TTL for authorization cache entries in milliseconds (default 5 minutes). */
	public get authorizationCacheTtlMs(): number {
		const value: string | undefined = process.env.AUTHORIZATION_CACHE_TTL_MS;
		const parsed: number = value ? Number.parseInt(value, 10) : 5 * 60 * 1000;
		return parsed > 0 ? parsed : 5 * 60 * 1000;
	}

	/** Maximum in-memory authorization cache entries per API instance (default 10_000). */
	public get authorizationCacheMaxEntries(): number {
		const value: string | undefined = process.env.AUTHORIZATION_CACHE_MAX_ENTRIES;
		const parsed: number = value ? Number.parseInt(value, 10) : 10_000;
		return parsed > 0 ? parsed : 10_000;
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

	/** Maximum in-memory `/auth/me` + `/auth/permissions` entries per instance (default 10_000). */
	public get userSessionCacheMaxEntries(): number {
		const value: string | undefined = process.env.USER_SESSION_CACHE_MAX_ENTRIES;
		const parsed: number = value ? Number.parseInt(value, 10) : 10_000;
		return parsed > 0 ? parsed : 10_000;
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

	/** Allowed browser origins for CORS and mutation-intent validation. */
	public get corsOrigins(): readonly string[] {
		const raw: string = process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:3001,http://localhost:3003";
		return raw
			.split(",")
			.map((origin: string): string => origin.trim())
			.filter((origin: string): boolean => origin.length > 0);
	}

	/** When true, enable Helmet and global rate limiting outside production-only branches. */
	public get securityHardeningEnabled(): boolean {
		if (process.env.SECURITY_HARDENING_ENABLED === "0") {
			return false;
		}
		return process.env.SECURITY_HARDENING_ENABLED === "1" || process.env.NODE_ENV === "production";
	}

	/** TTL for access-token account-state cache entries in milliseconds (default 30 seconds). */
	public get accessTokenStateCacheTtlMs(): number {
		const value: string | undefined = process.env.ACCESS_TOKEN_STATE_CACHE_TTL_MS;
		const parsed: number = value ? Number.parseInt(value, 10) : 30_000;
		return parsed > 0 ? parsed : 30_000;
	}

	/** Maximum in-memory access-token state entries per instance (default 50_000). */
	public get accessTokenStateCacheMaxEntries(): number {
		const value: string | undefined = process.env.ACCESS_TOKEN_STATE_CACHE_MAX_ENTRIES;
		const parsed: number = value ? Number.parseInt(value, 10) : 50_000;
		return parsed > 0 ? parsed : 50_000;
	}

	/**
	 * Maximum distinct security-counter keys (rate limits, throttler fallback)
	 * tracked in memory per instance. New keys are rejected when full (fail-closed).
	 */
	public get securityCounterMaxKeys(): number {
		const value: string | undefined = process.env.SECURITY_COUNTER_MAX_KEYS;
		const parsed: number = value ? Number.parseInt(value, 10) : 50_000;
		return parsed > 0 ? parsed : 50_000;
	}

	// ── Object storage (AWS S3 / local filesystem) ───────────────────

	public get storageBucket(): string {
		return this.storagePrivateBucket;
	}

	public get storagePrivateBucket(): string {
		return process.env.STORAGE_S3_PRIVATE_BUCKET ?? process.env.STORAGE_S3_BUCKET ?? "local-private-bucket";
	}

	public get storagePublicBucket(): string {
		return process.env.STORAGE_S3_PUBLIC_BUCKET ?? "local-public-bucket";
	}

	public get cloudfrontPublicDomain(): string | null {
		const value: string | undefined = process.env.STORAGE_CLOUDFRONT_PUBLIC_DOMAIN;
		return value !== undefined && value.length > 0 ? value : null;
	}

	public get apiPublicUrl(): string {
		return process.env.APP_URL ?? "http://localhost:3001";
	}

	public get storageProcessingCallbackSecret(): string | null {
		const value: string | undefined = process.env.STORAGE_PROCESSING_CALLBACK_SECRET;
		return value !== undefined && value.length > 0 ? value : null;
	}

	public get awsRegion(): string {
		return process.env.AWS_REGION ?? "ap-southeast-1";
	}

	public get awsAccessKeyId(): string | null {
		const value: string | undefined = process.env.AWS_ACCESS_KEY_ID;
		return value !== undefined && value.length > 0 ? value : null;
	}

	public get awsSecretAccessKey(): string | null {
		const value: string | undefined = process.env.AWS_SECRET_ACCESS_KEY;
		return value !== undefined && value.length > 0 ? value : null;
	}

	public get useS3Storage(): boolean {
		const bucket: string | undefined = process.env.STORAGE_S3_PRIVATE_BUCKET ?? process.env.STORAGE_S3_BUCKET;
		return bucket !== undefined && bucket.length > 0 && !bucket.startsWith("local-");
	}

	public get storageAutoScanInDev(): boolean {
		return process.env.STORAGE_AUTO_SCAN_IN_DEV !== "false" && process.env.KYB_AUTO_SCAN_IN_DEV !== "false";
	}

	public get storageScannerMode(): "lambda" | "clamav" {
		const value: string | undefined = process.env.STORAGE_SCANNER_MODE;
		if (value === "lambda") {
			return "lambda";
		}
		return "clamav";
	}

	public get storageScannerLambdaArn(): string | null {
		const value: string | undefined = process.env.STORAGE_SCANNER_LAMBDA_ARN;
		return value !== undefined && value.length > 0 ? value : null;
	}

	public get clamAvHost(): string {
		return process.env.STORAGE_CLAMAV_HOST ?? "127.0.0.1";
	}

	public get clamAvPort(): number {
		const parsed: number = Number.parseInt(process.env.STORAGE_CLAMAV_PORT ?? "3310", 10);
		return parsed > 0 ? parsed : 3310;
	}

	public get storageDownloadTtlSeconds(): number {
		const value: string | undefined = process.env.STORAGE_DOWNLOAD_TTL_SECONDS ?? process.env.KYB_DOCUMENT_DOWNLOAD_TTL_SECONDS;
		const parsed: number = value ? Number.parseInt(value, 10) : 300;
		return parsed > 0 ? parsed : 300;
	}

	/** Delay before physically deleting soft-deleted S3 objects (default 30 days; 1 hour in development). */
	public get storagePhysicalDeleteDelayMs(): number {
		const value: string | undefined = process.env.STORAGE_PHYSICAL_DELETE_DELAY_MS;
		if (value !== undefined && value.length > 0) {
			const parsed: number = Number.parseInt(value, 10);
			if (parsed > 0) {
				return parsed;
			}
		}
		return process.env.NODE_ENV === "production" ? 30 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
	}
}
