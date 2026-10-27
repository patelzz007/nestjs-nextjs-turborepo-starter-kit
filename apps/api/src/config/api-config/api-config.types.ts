// config/api-config/api-config.types.ts — The grouped, typed configuration the API reads (`ApiConfig`).
// Part of the API environment contract; `../api-config.schema.ts` is its public entry.

import type { AppVersion, GithubRepositoryParams, NodeEnv } from "@workspace/shared";
import type { KafkaSecurityOptions } from "@workspace/messaging/kafka";

import type {
	CacheBackend,
	EmailMode,
	EmailProvider,
	LoginVerificationMode,
	LogLevel,
	MalwareScannerSetting,
	StorageProviderSetting,
	SessionLocationProvider,
	TenantKmsProvider,
} from "../api-env.fields";

// ── Grouped output ─────────────────────────────────────────────────────────

/** Who may read the mounted docs: anyone (development/test) or only platform SuperAdmins (production). */
export type ApiDocsAccess = "public" | "platform_admin";

/**
 * Swagger exposure. Off by default in production (opt in with
 * SWAGGER_ENABLED=1); when mounted in production it is gated to platform
 * SuperAdmins (`ApiDocsAccessGate`). Development/test: on and public unless
 * SWAGGER_ENABLED=0.
 */
export interface ApiDocsPolicy {
	readonly enabled: boolean;
	readonly access: ApiDocsAccess;
}

export interface RuntimeConfig {
	readonly nodeEnv: NodeEnv;
	readonly isProduction: boolean;
	readonly isDevelopment: boolean;
	readonly isTest: boolean;
	readonly appName: string;
}

export interface HttpConfig {
	readonly host: string;
	readonly port: number;
	/**
	 * Base URL clients reach the API at (local-storage downloads, uploads and
	 * public images) — never a listen wildcard (`resolveApiPublicUrl`).
	 */
	readonly publicUrl: string;
	/** Proxies whose `X-Forwarded-For` is trusted (IPs, CIDRs, presets); empty = trust none (platform/infrastructure/http/client-ip.ts). */
	readonly trustedProxies: readonly string[];
	readonly corsOrigins: readonly string[];
	readonly cookieDomain: string | undefined;
	readonly securityHardeningEnabled: boolean;
	readonly apiDocs: ApiDocsPolicy;
	readonly shutdownTimeoutMs: number;
}

export interface ClientAppsConfig {
	readonly webUrl: string;
	readonly adminUrl: string;
	readonly merchantUrl: string;
}

export interface DatabaseConfig {
	readonly url: string;
	readonly poolMax: number;
	readonly idleTimeoutMs: number;
	/** Let the process exit while the pool is idle (dev/test convenience, never in production). */
	readonly allowExitOnIdle: boolean;
}

export interface AuthConfig {
	readonly jwtAccessSecret: string;
	readonly jwtAccessExpiry: string;
	readonly jwtRefreshSecret: string;
	readonly jwtRefreshExpiry: string;
	readonly emailVerificationSecret: string;
	readonly twoFactorPendingSecret: string;
	readonly twoFactorIssuer: string;
	readonly loginVerificationMode: LoginVerificationMode;
	readonly bcryptSaltRounds: number;
}

export interface MfaConfig {
	readonly encryptionKeys: Readonly<Record<number, string>>;
	readonly enrollmentDeadlineMs: number;
	readonly recoveryDelayMs: number;
	readonly stepUpTtlMs: number;
}

/** The mobile app (client type `mobile`, ADR 029 / 033). */
export interface MobileConfig {
	/**
	 * The oldest app version the API still serves (`MOBILE_MIN_SUPPORTED_VERSION`):
	 * a `mobile` request whose `X-App-Version` is missing, malformed or lower is
	 * answered 426 `APP_VERSION_UNSUPPORTED`. Raise it only after the new build
	 * is live in both stores.
	 */
	readonly minSupportedVersion: AppVersion;
}

/** Device sessions (docs/technical/mobile/mobile-app.md §8). */
export interface SessionsConfig {
	/** The `SessionLocationResolver` adapter (`SESSION_LOCATION_PROVIDER`); `none` resolves nothing. */
	readonly locationProvider: SessionLocationProvider;
	/** How long a sign-in waits for the location lookup before storing the session without one (`SESSION_LOCATION_TIMEOUT_MS`). */
	readonly locationTimeoutMs: number;
}

/** The read-only GitHub contributions integration (docs/technical/github-contributions.md). */
export interface GithubConfig {
	/** Token the API reads GitHub with (`GITHUB_TOKEN`); `null` leaves the integration off. */
	readonly token: string | null;
	/** Pinned repositories (`GITHUB_REPOSITORIES`), in the configured order; empty = discover them from the token's account. */
	readonly repositories: readonly GithubRepositoryParams[];
	/** Budget of one GitHub request (`GITHUB_REQUEST_TIMEOUT_MS`). */
	readonly requestTimeoutMs: number;
	/** How long an answer is reused before GitHub is read again (`GITHUB_CACHE_TTL_MS`). */
	readonly cacheTtlMs: number;
	/**
	 * Key ring the admins' linked tokens are encrypted with (`GITHUB_CREDENTIAL_ENCRYPTION_KEYS`,
	 * version → base64 of 32 bytes; the highest version encrypts). `null` turns pull requests off.
	 */
	readonly credentialEncryptionKeys: Readonly<Record<number, string>> | null;
	/**
	 * Live pull-request updates (`GITHUB_WEBHOOK_URL` + `GITHUB_WEBHOOK_SECRET`): where GitHub sends
	 * webhook deliveries, and the secret they are signed with. `null` turns live updates off.
	 */
	readonly webhook: { readonly url: string; readonly secret: string } | null;
}

export interface EncryptionConfig {
	/** Base64 of exactly 32 bytes — the CURRENT key-encryption key: wraps every new tenant data key. */
	readonly tenantMasterKey: string;
	/** Version of `tenantMasterKey`; recorded (in the KMS key id) with every data key it wraps. */
	readonly tenantMasterKeyVersion: number;
	/** Retired KEK versions (base64) that may still unwrap data keys until they are re-wrapped. */
	readonly tenantPreviousMasterKeys: Readonly<Record<number, string>>;
	/** Provider wrapping tenant data keys. */
	readonly tenantKmsProvider: TenantKmsProvider;
	/** HMAC key ring (version → base64 of 32 bytes) for reward QR-token / backup-code lookup hashes. */
	readonly rewardCodeHashKeys: Readonly<Record<number, string>>;
	/** HMAC secret for signed tenant job contexts; `null` = signing disabled (fails closed). */
	readonly tenantJobHmacSecret: string | null;
}

export interface EmailConfig {
	readonly mode: EmailMode;
	/** Who delivers when `mode` is `send`. `mailpit` only ever runs on localhost (enforced at parse time). */
	readonly provider: EmailProvider;
	/** Set whenever `mode` is `send` with the `resend` provider (enforced at parse time). */
	readonly resendApiKey: string | null;
	/** Base URL of the local Mailpit (web inbox + HTTP API), trailing slashes stripped. */
	readonly mailpitUrl: string;
	readonly fromAddress: string;
	readonly replyTo: string | undefined;
	readonly testTo: string | undefined;
	readonly maxAttempts: number;
	readonly timeoutMs: number;
	readonly rateLimitPerMinute: number;
	readonly resendWebhookSecret: string | null;
	readonly webhookRateLimitPerMinute: number;
}

export interface RateLimitConfig {
	readonly throttleDefaultLimit: number;
	readonly throttleStrictLimit: number;
	readonly throttleTtlMs: number;
	readonly securityCounterMaxKeys: number;
}

export interface CacheConfig {
	readonly authorizationBackend: CacheBackend;
	readonly authorizationTtlMs: number;
	readonly authorizationMaxEntries: number;
	readonly userSessionBackend: CacheBackend;
	readonly userSessionTtlMs: number;
	readonly userSessionMaxEntries: number;
	readonly accessTokenStateTtlMs: number;
	readonly accessTokenStateMaxEntries: number;
}

export interface MessagingConfig {
	readonly redisUrl: string | undefined;
	readonly kafkaBrokers: readonly string[] | undefined;
	/** TLS / SASL for the Kafka connection (`KAFKA_SSL*`, `KAFKA_SASL_*`). */
	readonly kafkaSecurity: KafkaSecurityOptions;
	/** Upper bound on one Kafka publish, retries included (`KAFKA_DELIVERY_TIMEOUT_MS`). */
	readonly kafkaDeliveryTimeoutMs: number;
	readonly rabbitmqUrl: string | undefined;
	readonly clientId: string;
	readonly connectionName: string;
	/** Key prefix of every BullMQ queue and worker (`BULLMQ_PREFIX`). */
	readonly bullPrefix: string;
	/** Namespace of every raw Redis key and pub/sub channel (`REDIS_NAMESPACE`, else derived — see {@link resolveRedisNamespace}). */
	readonly redisNamespace: string;
}

/** Resolved malware scanner. A future scanner adds its own variant (with its settings) here. */
export interface MalwareScannerConfig {
	readonly kind: MalwareScannerSetting;
}

export interface StorageConfig {
	readonly provider: StorageProviderSetting;
	readonly privateContainer: string;
	readonly publicContainer: string;
	readonly firebaseProjectId: string | null;
	readonly firebaseStorageBucket: string | null;
	readonly cloudfrontPublicDomain: string | null;
	readonly cloudfrontDistributionId: string | null;
	readonly awsRegion: string;
	readonly downloadTtlSeconds: number;
	readonly physicalDeleteDelayMs: number;
	readonly processingCallbackSecret: string | null;
	readonly malwareScanner: MalwareScannerConfig;
}

export interface ObserveConfig {
	readonly appKey: string;
	readonly appSecret: string;
	readonly serviceId: string;
}

/** Thresholds of the post-GC heap trend check (`MemoryMonitorService`). */
export interface MemoryLeakDetectionConfig {
	/** Heap samples taken before `startedAt + warmupMs` are ignored. */
	readonly warmupMs: number;
	/** Sliding window the trend is judged over; also the minimum gap between two warnings. */
	readonly windowMs: number;
	/** Rise of the post-GC heap floor (minimum) from the earlier to the later half of the window that triggers the warning. */
	readonly growthThresholdMb: number;
}

/** The plain-text transaction log (`TransactionLogModule`): one entry per audit row, in a file per day. */
export interface TransactionLogConfig {
	/** Folder of the day files; a relative path is resolved against the monorepo root (the working directory when there is none). */
	readonly directory: string;
	/** Day files older than this many days are deleted. */
	readonly retentionDays: number;
	/** IANA zone the entries' times are written in and the day files roll over in (TRANSACTION_LOG_TIME_ZONE, default: the server's own). */
	readonly timeZone: string;
}

export interface ObservabilityConfig {
	readonly logLevel: LogLevel;
	readonly memoryMonitoring: boolean;
	readonly memoryLeakDetection: MemoryLeakDetectionConfig;
	/** `null` when the transaction log is off. */
	readonly transactionLog: TransactionLogConfig | null;
	/** `null` when NestJS Observe is off. */
	readonly observe: ObserveConfig | null;
}

/**
 * Tenancy mode. Single mode serves exactly one real tenant
 * (verified to exist at boot by `DefaultTenantService`); multi mode
 * scopes every request to its guard-verified tenant only.
 */
export type TenancyConfig = { readonly mode: "single"; readonly defaultTenantId: string } | { readonly mode: "multi" };

/** The API's complete, validated configuration. Built once at startup. */
export interface ApiConfig {
	readonly runtime: RuntimeConfig;
	readonly http: HttpConfig;
	readonly clientApps: ClientAppsConfig;
	readonly database: DatabaseConfig;
	readonly auth: AuthConfig;
	readonly mfa: MfaConfig;
	readonly mobile: MobileConfig;
	readonly sessions: SessionsConfig;
	readonly github: GithubConfig;
	readonly encryption: EncryptionConfig;
	readonly email: EmailConfig;
	readonly rateLimits: RateLimitConfig;
	readonly caches: CacheConfig;
	readonly messaging: MessagingConfig;
	readonly storage: StorageConfig;
	readonly observability: ObservabilityConfig;
	readonly tenancy: TenancyConfig;
}
