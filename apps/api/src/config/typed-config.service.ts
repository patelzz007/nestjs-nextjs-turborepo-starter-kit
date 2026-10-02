import type { NodeEnv } from "@workspace/shared";

import type { ApiConfig, ApiDocsPolicy, ObserveConfig } from "./api-config.schema";
import type { CacheBackend, EmailMode, LogLevel, StorageProviderSetting } from "./api-env.fields";

/** Client apps an auth flow can originate from (`X-Client-Type`). */
const ADMIN_CLIENT_TYPE = "admin";
const MERCHANT_CLIENT_TYPE = "merchant";

/**
 * Typed, read-only access to the API configuration.
 *
 * Backed by the `ApiConfig` that `api-config.ts` parsed ONCE from the
 * environment through the zod schema in `api-config.schema.ts` — nothing
 * here reads `process.env`, applies a fallback, or can fail at request time.
 * Provided by the global `ConfigModule`; tests build one from a fixture with
 * `createTestTypedConfig()` (test/support/test-api-env.ts).
 */
export class TypedConfigService {
	public constructor(private readonly config: ApiConfig) {}

	// ── Runtime ────────────────────────────────────────────────────────

	public get nodeEnv(): NodeEnv {
		return this.config.runtime.nodeEnv;
	}

	public get isProduction(): boolean {
		return this.config.runtime.isProduction;
	}

	public get isDevelopment(): boolean {
		return this.config.runtime.isDevelopment;
	}

	public get isTest(): boolean {
		return this.config.runtime.isTest;
	}

	/** Application name (used in email templates) */
	public get appName(): string {
		return this.config.runtime.appName;
	}

	// ── HTTP server ────────────────────────────────────────────────────

	public get host(): string {
		return this.config.http.host;
	}

	public get port(): number {
		return this.config.http.port;
	}

	/** Trust `X-Forwarded-For` (behind cloudflared / a reverse proxy). */
	public get trustProxy(): boolean {
		return this.config.http.trustProxy;
	}

	/** Allowed browser origins for CORS and mutation-intent validation. */
	public get corsOrigins(): readonly string[] {
		return this.config.http.corsOrigins;
	}

	/** Cookie `Domain` for auth cookies (`undefined` = host-only cookies). */
	public get cookieDomain(): string | undefined {
		return this.config.http.cookieDomain;
	}

	/** Auth cookies carry `Secure` in production. */
	public get secureCookies(): boolean {
		return this.config.runtime.isProduction;
	}

	/** Helmet + global rate limiting: on in production, opt-in elsewhere (`SECURITY_HARDENING_ENABLED`). */
	public get securityHardeningEnabled(): boolean {
		return this.config.http.securityHardeningEnabled;
	}

	/** Swagger exposure policy (`SWAGGER_ENABLED`; the docs are public when mounted). */
	public get apiDocsPolicy(): ApiDocsPolicy {
		return this.config.http.apiDocs;
	}

	/** Graceful-shutdown budget before the process is force-exited. */
	public get shutdownTimeoutMs(): number {
		return this.config.http.shutdownTimeoutMs;
	}

	/** Base URL the API itself is reachable at (local-storage links). */
	public get apiPublicUrl(): string {
		return this.config.http.publicUrl;
	}

	// ── Frontend apps ──────────────────────────────────────────────────

	/** Public-facing web app URL (used in email links) */
	public get appUrl(): string {
		return this.config.clientApps.webUrl;
	}

	/** Admin panel URL for admin-specific email links. */
	public get adminAppUrl(): string {
		return this.config.clientApps.adminUrl;
	}

	/** Merchant portal URL for onboarding invite links. */
	public get merchantAppUrl(): string {
		return this.config.clientApps.merchantUrl;
	}

	/** Resolve the frontend base URL for a given auth client type. */
	public resolveClientAppUrl(clientType: string | undefined): string {
		if (clientType === ADMIN_CLIENT_TYPE) {
			return this.adminAppUrl;
		}
		if (clientType === MERCHANT_CLIENT_TYPE) {
			return this.merchantAppUrl;
		}
		return this.appUrl;
	}

	// ── Database ───────────────────────────────────────────────────────

	public get databaseUrl(): string {
		return this.config.database.url;
	}

	public get databasePoolMax(): number {
		return this.config.database.poolMax;
	}

	public get databaseIdleTimeoutMs(): number {
		return this.config.database.idleTimeoutMs;
	}

	public get databaseAllowExitOnIdle(): boolean {
		return this.config.database.allowExitOnIdle;
	}

	// ── JWT / auth ─────────────────────────────────────────────────────

	/** Secret key for signing access tokens */
	public get jwtAccessSecret(): string {
		return this.config.auth.jwtAccessSecret;
	}

	/** Expiry duration for access tokens (e.g. "15m") */
	public get jwtAccessExpiry(): string {
		return this.config.auth.jwtAccessExpiry;
	}

	/** Secret key for signing refresh tokens */
	public get jwtRefreshSecret(): string {
		return this.config.auth.jwtRefreshSecret;
	}

	/** Expiry duration for refresh tokens (e.g. "7d") */
	public get jwtRefreshExpiry(): string {
		return this.config.auth.jwtRefreshExpiry;
	}

	/** Secret key for email verification tokens */
	public get emailVerificationSecret(): string {
		return this.config.auth.emailVerificationSecret;
	}

	/** Secret key for short-lived 2FA login step tokens */
	public get twoFactorPendingSecret(): string {
		return this.config.auth.twoFactorPendingSecret;
	}

	/** When true, every login requires the email OTP step (ignores trusted-device cache). */
	public get forceLoginVerification(): boolean {
		return this.config.auth.forceLoginVerification;
	}

	/** Issuer name shown in authenticator apps */
	public get twoFactorIssuer(): string {
		return this.config.auth.twoFactorIssuer;
	}

	/** Number of bcrypt salt rounds for password hashing */
	public get bcryptSaltRounds(): number {
		return this.config.auth.bcryptSaltRounds;
	}

	// ── MFA hardening ──────────────────────────────────────────────────

	/** Versioned AES-256 key material for MFA secret encryption (`MFA_ENCRYPTION_KEYS`). */
	public get mfaEncryptionKeys(): Readonly<Record<number, string>> {
		return this.config.mfa.encryptionKeys;
	}

	/** Grace period before MFA enrollment is required. */
	public get mfaEnrollmentDeadlineMs(): number {
		return this.config.mfa.enrollmentDeadlineMs;
	}

	/** Delay after recovery approval before MFA is unlocked. */
	public get mfaRecoveryDelayMs(): number {
		return this.config.mfa.recoveryDelayMs;
	}

	/** TTL for step-up MFA assurance after verification. */
	public get mfaStepUpTtlMs(): number {
		return this.config.mfa.stepUpTtlMs;
	}

	// ── Encryption ─────────────────────────────────────────────────────

	/** Decoded 32-byte tenant master key (a fresh copy per call — callers cannot mutate the config). */
	public get tenantEncryptionMasterKey(): Buffer {
		return Buffer.from(this.config.encryption.tenantMasterKey, "base64");
	}

	/** HMAC secret for tenant job contexts; `null` when job signing is not configured. */
	public get tenantJobHmacSecret(): string | null {
		return this.config.encryption.tenantJobHmacSecret;
	}

	// ── Email ──────────────────────────────────────────────────────────

	/** Resend API key; always set when `emailMode` is `send`. */
	public get resendApiKey(): string | null {
		return this.config.email.resendApiKey;
	}

	/** From address for outgoing emails (e.g. "noreply@example.com") */
	public get emailFromAddress(): string {
		return this.config.email.fromAddress;
	}

	/** Send mode: "send" (real Resend), "log-only" (print), or "noop" (skip). */
	public get emailMode(): EmailMode {
		return this.config.email.mode;
	}

	/** Dev-only override that redirects every send to a single inbox (rejected in production). */
	public get emailTestTo(): string | undefined {
		return this.config.email.testTo;
	}

	/** Reply-to address appended to every outbound email. */
	public get emailReplyTo(): string | undefined {
		return this.config.email.replyTo;
	}

	/** Max attempts per send (including the first try) — retry with backoff. */
	public get emailMaxAttempts(): number {
		return this.config.email.maxAttempts;
	}

	/** Per-send timeout in milliseconds. */
	public get emailTimeoutMs(): number {
		return this.config.email.timeoutMs;
	}

	/** Per-recipient sends-per-minute cap; 0 disables rate limiting. */
	public get emailRateLimitPerMinute(): number {
		return this.config.email.rateLimitPerMinute;
	}

	/** Secret used to verify Resend webhook signatures; `null` = webhook not wired up. */
	public get resendWebhookSecret(): string | null {
		return this.config.email.resendWebhookSecret;
	}

	/** Per-IP requests-per-minute cap on the public delivery-webhook endpoint; `0` disables it. */
	public get webhookRateLimitPerMinute(): number {
		return this.config.email.webhookRateLimitPerMinute;
	}

	// ── HTTP throttling ────────────────────────────────────────────────

	/** Authenticated mutation throttle — requests per IP per window (`default` throttler). */
	public get throttleDefaultLimit(): number {
		return this.config.rateLimits.throttleDefaultLimit;
	}

	/** Credential / sensitive endpoint throttle — requests per IP per window (`strict` throttler). */
	public get throttleStrictLimit(): number {
		return this.config.rateLimits.throttleStrictLimit;
	}

	/** Throttle window in milliseconds for both named throttlers. */
	public get throttleTtlMs(): number {
		return this.config.rateLimits.throttleTtlMs;
	}

	/**
	 * Maximum distinct security-counter keys (rate limits, throttler fallback)
	 * tracked in memory per instance. New keys are rejected when full (fail-closed).
	 */
	public get securityCounterMaxKeys(): number {
		return this.config.rateLimits.securityCounterMaxKeys;
	}

	// ── Caches ─────────────────────────────────────────────────────────

	/** TTL for authorization cache entries in milliseconds. */
	public get authorizationCacheTtlMs(): number {
		return this.config.caches.authorizationTtlMs;
	}

	/** Maximum in-memory authorization cache entries per API instance. */
	public get authorizationCacheMaxEntries(): number {
		return this.config.caches.authorizationMaxEntries;
	}

	/** Resolved authorization cache backend (`auto` already applied). */
	public get authorizationCacheBackend(): CacheBackend {
		return this.config.caches.authorizationBackend;
	}

	public get useRedisAuthorizationCache(): boolean {
		return this.authorizationCacheBackend === "redis" && this.redisUrl !== undefined;
	}

	/** TTL for user session cache entries in milliseconds. */
	public get userSessionCacheTtlMs(): number {
		return this.config.caches.userSessionTtlMs;
	}

	/** Maximum in-memory `/auth/me` + `/auth/permissions` entries per instance. */
	public get userSessionCacheMaxEntries(): number {
		return this.config.caches.userSessionMaxEntries;
	}

	/** Resolved user session cache backend (`auto` already applied). */
	public get userSessionCacheBackend(): CacheBackend {
		return this.config.caches.userSessionBackend;
	}

	public get useRedisUserSessionCache(): boolean {
		return this.userSessionCacheBackend === "redis" && this.redisUrl !== undefined;
	}

	/** TTL for access-token account-state cache entries in milliseconds. */
	public get accessTokenStateCacheTtlMs(): number {
		return this.config.caches.accessTokenStateTtlMs;
	}

	/** Maximum in-memory access-token state entries per instance. */
	public get accessTokenStateCacheMaxEntries(): number {
		return this.config.caches.accessTokenStateMaxEntries;
	}

	// ── Redis / Kafka / RabbitMQ ───────────────────────────────────────

	/** Redis connection URL for distributed cache invalidation and BullMQ job queues. */
	public get redisUrl(): string | undefined {
		return this.config.messaging.redisUrl;
	}

	/** Whether BullMQ workers and producers should be active. */
	public get useBullMq(): boolean {
		return this.redisUrl !== undefined;
	}

	/** Kafka bootstrap servers. */
	public get kafkaBrokers(): readonly string[] | undefined {
		return this.config.messaging.kafkaBrokers;
	}

	/** Whether the Kafka producer and event bridge should be active. */
	public get useKafka(): boolean {
		return this.kafkaBrokers !== undefined;
	}

	/** RabbitMQ AMQP URL. */
	public get rabbitmqUrl(): string | undefined {
		return this.config.messaging.rabbitmqUrl;
	}

	/** Kafka / kafkajs client id. */
	public get messagingClientId(): string {
		return this.config.messaging.clientId;
	}

	/** ioredis `connectionName`. */
	public get messagingConnectionName(): string {
		return this.config.messaging.connectionName;
	}

	// ── Object storage (local / S3 / Firebase) ───────────────────────

	public get storageProvider(): StorageProviderSetting {
		return this.config.storage.provider;
	}

	public get storageBucket(): string {
		return this.storagePrivateBucket;
	}

	public get storagePrivateBucket(): string {
		return this.config.storage.privateContainer;
	}

	public get storagePublicBucket(): string {
		return this.config.storage.publicContainer;
	}

	public get firebaseProjectId(): string | null {
		return this.config.storage.firebaseProjectId;
	}

	public get firebaseStorageBucket(): string | null {
		return this.config.storage.firebaseStorageBucket;
	}

	public get cloudfrontPublicDomain(): string | null {
		return this.config.storage.cloudfrontPublicDomain;
	}

	/** Shared secret for `POST /files/processing-callback`; `null` = callbacks are rejected. */
	public get storageProcessingCallbackSecret(): string | null {
		return this.config.storage.processingCallbackSecret;
	}

	public get awsRegion(): string {
		return this.config.storage.awsRegion;
	}

	public get awsAccessKeyId(): string | null {
		return this.config.storage.awsAccessKeyId;
	}

	public get awsSecretAccessKey(): string | null {
		return this.config.storage.awsSecretAccessKey;
	}

	public get useS3Storage(): boolean {
		return this.storageProvider === "s3";
	}

	public get useFirebaseStorage(): boolean {
		return this.storageProvider === "firebase";
	}

	public get useLocalStorage(): boolean {
		return this.storageProvider === "local";
	}

	public get storageDownloadTtlSeconds(): number {
		return this.config.storage.downloadTtlSeconds;
	}

	/** Delay before physically deleting soft-deleted objects (30 days in production, 1 hour elsewhere, unless set). */
	public get storagePhysicalDeleteDelayMs(): number {
		return this.config.storage.physicalDeleteDelayMs;
	}

	// ── Observability ──────────────────────────────────────────────────

	public get logLevel(): LogLevel {
		return this.config.observability.logLevel;
	}

	/** Prisma query/info event logging (LOG_LEVEL debug or trace). */
	public get isDebugLogging(): boolean {
		return this.logLevel === "debug" || this.logLevel === "trace";
	}

	/** Heap sampling / leak detection in `LogService` (always on in production). */
	public get memoryMonitoring(): boolean {
		return this.config.observability.memoryMonitoring;
	}

	/** NestJS Observe credentials; `null` when Observe is off. */
	public get observe(): ObserveConfig | null {
		return this.config.observability.observe;
	}

	// ── Tenancy ────────────────────────────────────────────────────────

	public get tenancyEnabled(): boolean {
		return this.config.tenancy.enabled;
	}

	public get defaultOrganizationId(): string {
		return this.config.tenancy.defaultOrganizationId;
	}
}
