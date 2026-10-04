// ============================================
// config/api-config.schema.ts - THE contract for the API's environment
// ============================================
// One zod schema for every variable apps/api reads. It is pure (never
// touches `process.env`): `api-config.ts` hands it the source record and
// parses it once, at startup, through `parseEnvOrThrow` — which lists every
// invalid/missing variable by name and never prints a value.
//
// The flat, variable-named input is transformed into a grouped, typed
// `ApiConfig`. `TypedConfigService` exposes it to the Nest graph.
// See docs/technical/configuration/api.md.

import {
	BooleanFlagEnvSchema,
	CookieDomainEnvSchema,
	HttpUrlEnvSchema,
	integerEnvSchema,
	KafkaBrokersEnvSchema,
	NodeEnvSchema,
	optionalIntegerEnvSchema,
	PostgresUrlEnvSchema,
	type NodeEnv,
} from "@workspace/shared";
import { KafkaSecurityEnvShape, listKafkaSecurityEnvIssues, toKafkaSecurityOptions, type KafkaSecurityOptions } from "@workspace/messaging/kafka";
import { z } from "zod";

import { TrustProxyEnvSchema } from "../common/http/client-ip";

import {
	BullMqPrefixEnvSchema,
	RedisNamespaceEnvSchema,
	Aes256KeyEnvSchema,
	CdnHostEnvSchema,
	CloudFrontDistributionIdEnvSchema,
	AmqpUrlEnvSchema,
	CacheBackendSettingSchema,
	CorsOriginsEnvSchema,
	EmailModeSchema,
	jwtExpiryEnvSchema,
	LoginVerificationModeSchema,
	LogLevelSchema,
	MalwareScannerSettingSchema,
	MfaEncryptionKeysEnvSchema,
	RewardCodeHashKeysEnvSchema,
	RetiredTenantMasterKeysEnvSchema,
	NonEmptyEnvStringSchema,
	OptionalToggleEnvSchema,
	RedisUrlEnvSchema,
	SecretEnvSchema,
	StorageProviderSettingSchema,
	type CacheBackend,
	type CacheBackendSetting,
	type EmailMode,
	type LoginVerificationMode,
	type LogLevel,
	type MalwareScannerSetting,
	type StorageProviderSetting,
	TenantKmsProviderSchema,
	type TenantKmsProvider,
} from "./api-env.fields";

// ── Durations and defaults (named, never magic) ────────────────────────────

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const MAX_TCP_PORT = 65_535;
const DEFAULT_PORT = 8080;
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 15 * MS_PER_SECOND;

const DEFAULT_DB_POOL_MAX = 10;
const DEFAULT_DB_IDLE_TIMEOUT_MS = 30 * MS_PER_SECOND;

const DEFAULT_JWT_ACCESS_EXPIRY = "15m";
const DEFAULT_JWT_REFRESH_EXPIRY = "7d";
/** OWASP floor for bcrypt work factor; above 15 hashing becomes a DoS vector. */
const MIN_BCRYPT_SALT_ROUNDS = 10;
const MAX_BCRYPT_SALT_ROUNDS = 15;
const DEFAULT_BCRYPT_SALT_ROUNDS = 12;

const DEFAULT_MFA_ENROLLMENT_DEADLINE_MS = 30 * MS_PER_DAY;
const DEFAULT_MFA_RECOVERY_DELAY_MS = MS_PER_DAY;
const DEFAULT_MFA_STEP_UP_TTL_MS = 5 * MS_PER_MINUTE;
/** Version of `TENANT_ENCRYPTION_MASTER_KEY` when `TENANT_ENCRYPTION_MASTER_KEY_VERSION` is unset (the first KEK). */
const DEFAULT_TENANT_MASTER_KEY_VERSION = 1;
/** KMS provider outside production when `TENANT_KMS_PROVIDER` is unset. Production must set it explicitly. */
const NON_PRODUCTION_TENANT_KMS_PROVIDER: TenantKmsProvider = "local";

const MAX_EMAIL_ATTEMPTS = 10;
const DEFAULT_EMAIL_ATTEMPTS = 3;
const MIN_EMAIL_TIMEOUT_MS = 100;
const DEFAULT_EMAIL_TIMEOUT_MS = 10 * MS_PER_SECOND;
const DEFAULT_WEBHOOK_RATE_LIMIT_PER_MINUTE = 120;

const DEFAULT_THROTTLE_DEFAULT_LIMIT = 300;
const DEFAULT_THROTTLE_STRICT_LIMIT = 30;
const MIN_THROTTLE_TTL_MS = MS_PER_SECOND;
const DEFAULT_THROTTLE_TTL_MS = MS_PER_MINUTE;

const DEFAULT_AUTHORIZATION_CACHE_TTL_MS = 5 * MS_PER_MINUTE;
const DEFAULT_USER_SESSION_CACHE_TTL_MS = 30 * MS_PER_MINUTE;
const DEFAULT_ACCESS_TOKEN_STATE_CACHE_TTL_MS = 30 * MS_PER_SECOND;
const DEFAULT_CACHE_MAX_ENTRIES = 10_000;
const DEFAULT_ACCESS_TOKEN_STATE_CACHE_MAX_ENTRIES = 50_000;
const DEFAULT_SECURITY_COUNTER_MAX_KEYS = 50_000;

const DEFAULT_STORAGE_DOWNLOAD_TTL_SECONDS = 300;
const PRODUCTION_STORAGE_PHYSICAL_DELETE_DELAY_MS = 30 * MS_PER_DAY;
const NON_PRODUCTION_STORAGE_PHYSICAL_DELETE_DELAY_MS = MS_PER_HOUR;
const DEFAULT_AWS_REGION = "ap-southeast-1";
/** Local-provider container names (directories under apps/api/.object-storage). */
const LOCAL_PRIVATE_CONTAINER = "local-private-bucket";
const LOCAL_PUBLIC_CONTAINER = "local-public-bucket";
/** Buckets named `local-*` are local-provider containers, never S3 buckets. */
const LOCAL_CONTAINER_PREFIX = "local-";

/**
 * LOG_LEVEL when it is not set: development shows Nest's `log` level (route mapping, module
 * start-up) so `pnpm dev` lists the API's endpoints; every other environment stays quiet.
 */
const DEFAULT_LOG_LEVEL_BY_NODE_ENV: Readonly<Record<NodeEnv, LogLevel>> = {
	development: "info",
	test: "warn",
	production: "warn",
};
/**
 * Memory leak detection (`MemoryMonitorService`): heap growth inside the
 * first minutes is module loading, JIT and cache warm-up — never judged.
 */
const DEFAULT_MEMORY_LEAK_WARMUP_MS = 5 * MS_PER_MINUTE;
/** Window over which the post-GC heap floor must keep rising before a leak is reported. */
const DEFAULT_MEMORY_LEAK_WINDOW_MS = 30 * MS_PER_MINUTE;
/** A window shorter than this sees too few major GCs to tell a trend from noise. */
const MIN_MEMORY_LEAK_WINDOW_MS = 5 * MS_PER_MINUTE;
/** Rise of the post-GC heap floor from the earlier to the later half of the window that counts as a suspected leak. */
const DEFAULT_MEMORY_LEAK_GROWTH_THRESHOLD_MB = 64;
const DEFAULT_OBSERVE_SERVICE_ID = "freebuff-api";
const DEFAULT_MESSAGING_CLIENT_ID = "hello-world-api";
/** BullMQ key prefix — also Bull Board's `BULL_PREFIX` in compose.yml. */
const DEFAULT_BULLMQ_PREFIX = "bull";
/** Kafka publish budget (retries included) before the outbox dispatcher sees a failure and backs off. */
const DEFAULT_KAFKA_DELIVERY_TIMEOUT_MS = 30 * MS_PER_SECOND;
/** librdkafka's floor for `message.timeout.ms` (1 s). */
const MIN_KAFKA_DELIVERY_TIMEOUT_MS = MS_PER_SECOND;

// ── Flat input schema (keys are the variable names) ────────────────────────

/**
 * Not strict: `process.env` carries the whole OS environment (PATH, HOME, …),
 * so unknown keys are ignored rather than rejected.
 */
export const ApiEnvInputSchema = z.object({
	// Runtime
	NODE_ENV: NodeEnvSchema,
	APP_NAME: NonEmptyEnvStringSchema,

	// HTTP server
	HOST: NonEmptyEnvStringSchema.default(DEFAULT_HOST),
	PORT: integerEnvSchema({ min: 1, max: MAX_TCP_PORT, defaultValue: DEFAULT_PORT }),
	API_PUBLIC_URL: HttpUrlEnvSchema.optional(),
	TRUST_PROXY: TrustProxyEnvSchema,
	CORS_ORIGINS: CorsOriginsEnvSchema,
	COOKIE_DOMAIN: CookieDomainEnvSchema.optional(),
	SECURITY_HARDENING_ENABLED: OptionalToggleEnvSchema,
	SWAGGER_ENABLED: OptionalToggleEnvSchema,
	SHUTDOWN_TIMEOUT_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_SHUTDOWN_TIMEOUT_MS }),

	// Frontend origins used in email links
	APP_URL: HttpUrlEnvSchema,
	ADMIN_APP_URL: HttpUrlEnvSchema,
	MERCHANT_APP_URL: HttpUrlEnvSchema,

	// Database
	DATABASE_URL: PostgresUrlEnvSchema,
	DB_POOL_MAX: integerEnvSchema({ min: 1, defaultValue: DEFAULT_DB_POOL_MAX }),
	DB_IDLE_TIMEOUT_MS: integerEnvSchema({ min: 0, defaultValue: DEFAULT_DB_IDLE_TIMEOUT_MS }),

	// Auth / JWT
	JWT_ACCESS_SECRET: SecretEnvSchema,
	JWT_ACCESS_EXPIRY: jwtExpiryEnvSchema(DEFAULT_JWT_ACCESS_EXPIRY),
	JWT_REFRESH_SECRET: SecretEnvSchema,
	JWT_REFRESH_EXPIRY: jwtExpiryEnvSchema(DEFAULT_JWT_REFRESH_EXPIRY),
	EMAIL_VERIFICATION_SECRET: SecretEnvSchema,
	TWO_FACTOR_PENDING_SECRET: SecretEnvSchema,
	TWO_FACTOR_ISSUER: NonEmptyEnvStringSchema.optional(),
	LOGIN_VERIFICATION_MODE: LoginVerificationModeSchema.default("new-device"),
	BCRYPT_SALT_ROUNDS: integerEnvSchema({ min: MIN_BCRYPT_SALT_ROUNDS, max: MAX_BCRYPT_SALT_ROUNDS, defaultValue: DEFAULT_BCRYPT_SALT_ROUNDS }),

	// MFA / encryption
	MFA_ENCRYPTION_KEYS: MfaEncryptionKeysEnvSchema,
	MFA_ENROLLMENT_DEADLINE_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_MFA_ENROLLMENT_DEADLINE_MS }),
	MFA_RECOVERY_DELAY_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_MFA_RECOVERY_DELAY_MS }),
	MFA_STEP_UP_TTL_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_MFA_STEP_UP_TTL_MS }),
	TENANT_ENCRYPTION_MASTER_KEY: Aes256KeyEnvSchema,
	TENANT_ENCRYPTION_MASTER_KEY_VERSION: integerEnvSchema({ min: 1, defaultValue: DEFAULT_TENANT_MASTER_KEY_VERSION }),
	TENANT_ENCRYPTION_PREVIOUS_MASTER_KEYS: RetiredTenantMasterKeysEnvSchema.optional(),
	TENANT_KMS_PROVIDER: TenantKmsProviderSchema.optional(),
	TENANT_JOB_HMAC_SECRET: SecretEnvSchema.optional(),
	REWARD_CODE_HASH_KEYS: RewardCodeHashKeysEnvSchema,

	// Email
	EMAIL_MODE: EmailModeSchema.default("send"),
	RESEND_API_KEY: NonEmptyEnvStringSchema.optional(),
	EMAIL_FROM_ADDRESS: z.email({ error: "must be an email address" }),
	EMAIL_REPLY_TO: z.email({ error: "must be an email address" }).optional(),
	EMAIL_TEST_TO: z.email({ error: "must be an email address" }).optional(),
	EMAIL_MAX_ATTEMPTS: integerEnvSchema({ min: 1, max: MAX_EMAIL_ATTEMPTS, defaultValue: DEFAULT_EMAIL_ATTEMPTS }),
	EMAIL_TIMEOUT_MS: integerEnvSchema({ min: MIN_EMAIL_TIMEOUT_MS, defaultValue: DEFAULT_EMAIL_TIMEOUT_MS }),
	EMAIL_RATE_LIMIT_PER_MINUTE: integerEnvSchema({ min: 0, defaultValue: 0 }),
	RESEND_WEBHOOK_SECRET: NonEmptyEnvStringSchema.optional(),
	WEBHOOK_RATE_LIMIT_PER_MINUTE: integerEnvSchema({ min: 0, defaultValue: DEFAULT_WEBHOOK_RATE_LIMIT_PER_MINUTE }),

	// Rate limits / caches
	THROTTLE_DEFAULT_LIMIT: integerEnvSchema({ min: 1, defaultValue: DEFAULT_THROTTLE_DEFAULT_LIMIT }),
	THROTTLE_STRICT_LIMIT: integerEnvSchema({ min: 1, defaultValue: DEFAULT_THROTTLE_STRICT_LIMIT }),
	THROTTLE_TTL_MS: integerEnvSchema({ min: MIN_THROTTLE_TTL_MS, defaultValue: DEFAULT_THROTTLE_TTL_MS }),
	SECURITY_COUNTER_MAX_KEYS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_SECURITY_COUNTER_MAX_KEYS }),
	AUTHORIZATION_CACHE_BACKEND: CacheBackendSettingSchema.default("auto"),
	AUTHORIZATION_CACHE_TTL_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_AUTHORIZATION_CACHE_TTL_MS }),
	AUTHORIZATION_CACHE_MAX_ENTRIES: integerEnvSchema({ min: 1, defaultValue: DEFAULT_CACHE_MAX_ENTRIES }),
	USER_SESSION_CACHE_BACKEND: CacheBackendSettingSchema.default("auto"),
	USER_SESSION_CACHE_TTL_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_USER_SESSION_CACHE_TTL_MS }),
	USER_SESSION_CACHE_MAX_ENTRIES: integerEnvSchema({ min: 1, defaultValue: DEFAULT_CACHE_MAX_ENTRIES }),
	ACCESS_TOKEN_STATE_CACHE_TTL_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_ACCESS_TOKEN_STATE_CACHE_TTL_MS }),
	ACCESS_TOKEN_STATE_CACHE_MAX_ENTRIES: integerEnvSchema({ min: 1, defaultValue: DEFAULT_ACCESS_TOKEN_STATE_CACHE_MAX_ENTRIES }),

	// Redis / Kafka / RabbitMQ
	REDIS_URL: RedisUrlEnvSchema.optional(),
	KAFKA_BROKERS: KafkaBrokersEnvSchema.optional(),
	RABBITMQ_URL: AmqpUrlEnvSchema.optional(),
	MESSAGING_CLIENT_ID: NonEmptyEnvStringSchema.default(DEFAULT_MESSAGING_CLIENT_ID),
	MESSAGING_CONNECTION_NAME: NonEmptyEnvStringSchema.default(DEFAULT_MESSAGING_CLIENT_ID),
	BULLMQ_PREFIX: BullMqPrefixEnvSchema.default(DEFAULT_BULLMQ_PREFIX),
	REDIS_NAMESPACE: RedisNamespaceEnvSchema.optional(),
	...KafkaSecurityEnvShape,
	KAFKA_DELIVERY_TIMEOUT_MS: integerEnvSchema({ min: MIN_KAFKA_DELIVERY_TIMEOUT_MS, defaultValue: DEFAULT_KAFKA_DELIVERY_TIMEOUT_MS }),

	// Object storage
	STORAGE_PROVIDER: StorageProviderSettingSchema.optional(),
	STORAGE_PRIVATE_CONTAINER: NonEmptyEnvStringSchema.optional(),
	STORAGE_PUBLIC_CONTAINER: NonEmptyEnvStringSchema.optional(),
	STORAGE_S3_BUCKET: NonEmptyEnvStringSchema.optional(),
	STORAGE_S3_PRIVATE_BUCKET: NonEmptyEnvStringSchema.optional(),
	STORAGE_S3_PUBLIC_BUCKET: NonEmptyEnvStringSchema.optional(),
	STORAGE_CLOUDFRONT_PUBLIC_DOMAIN: CdnHostEnvSchema.optional(),
	STORAGE_CLOUDFRONT_DISTRIBUTION_ID: CloudFrontDistributionIdEnvSchema.optional(),
	FIREBASE_PROJECT_ID: NonEmptyEnvStringSchema.optional(),
	FIREBASE_STORAGE_BUCKET: NonEmptyEnvStringSchema.optional(),
	AWS_REGION: NonEmptyEnvStringSchema.default(DEFAULT_AWS_REGION),
	// Static AWS keys are never read by our code: the AWS SDK's default
	// credential chain picks them up from the environment. They are declared
	// here only so the cross-field rules can allow them for local development
	// and reject them on a deployed production environment (IAM role only).
	AWS_ACCESS_KEY_ID: NonEmptyEnvStringSchema.optional(),
	AWS_SECRET_ACCESS_KEY: NonEmptyEnvStringSchema.optional(),
	STORAGE_DOWNLOAD_TTL_SECONDS: optionalIntegerEnvSchema({ min: 1 }),
	KYB_DOCUMENT_DOWNLOAD_TTL_SECONDS: optionalIntegerEnvSchema({ min: 1 }),
	STORAGE_PHYSICAL_DELETE_DELAY_MS: optionalIntegerEnvSchema({ min: 1 }),
	STORAGE_PROCESSING_CALLBACK_SECRET: SecretEnvSchema.optional(),
	MALWARE_SCANNER: MalwareScannerSettingSchema,

	// Observability
	LOG_LEVEL: LogLevelSchema.optional(),
	MEMORY_MONITORING: BooleanFlagEnvSchema,
	MEMORY_LEAK_WARMUP_MS: integerEnvSchema({ min: 0, defaultValue: DEFAULT_MEMORY_LEAK_WARMUP_MS }),
	MEMORY_LEAK_WINDOW_MS: integerEnvSchema({ min: MIN_MEMORY_LEAK_WINDOW_MS, defaultValue: DEFAULT_MEMORY_LEAK_WINDOW_MS }),
	MEMORY_LEAK_GROWTH_THRESHOLD_MB: integerEnvSchema({ min: 1, defaultValue: DEFAULT_MEMORY_LEAK_GROWTH_THRESHOLD_MB }),
	OBSERVE_ENABLED: OptionalToggleEnvSchema,
	OBSERVE_APP_KEY: NonEmptyEnvStringSchema.optional(),
	OBSERVE_APP_SECRET: NonEmptyEnvStringSchema.optional(),
	OBSERVE_SERVICE_ID: NonEmptyEnvStringSchema.default(DEFAULT_OBSERVE_SERVICE_ID),

	// Tenancy
	TENANCY_ENABLED: BooleanFlagEnvSchema,
	/** Id of the real organization a single-tenant deployment serves (required when TENANCY_ENABLED is off). */
	DEFAULT_ORGANIZATION_ID: z.uuid({ error: "must be the id (uuid) of an existing organization" }).optional(),
});

/** The validated flat environment, before grouping. */
export type ApiEnv = z.output<typeof ApiEnvInputSchema>;

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
	/** Base URL the API is reachable at (local-storage download/upload links). */
	readonly publicUrl: string;
	/** Proxies whose `X-Forwarded-For` is trusted (IPs, CIDRs, presets); empty = trust none (common/http/client-ip.ts). */
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
	/** Set whenever `mode` is `send` (enforced at parse time). */
	readonly resendApiKey: string | null;
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

export interface ObservabilityConfig {
	readonly logLevel: LogLevel;
	readonly memoryMonitoring: boolean;
	readonly memoryLeakDetection: MemoryLeakDetectionConfig;
	/** `null` when NestJS Observe is off. */
	readonly observe: ObserveConfig | null;
}

/**
 * Tenancy mode. Single-tenant mode serves exactly one REAL organization
 * (verified to exist at boot by `DefaultOrganizationService`); multi-tenant
 * mode scopes every request to its guard-verified organization only.
 */
export type TenancyConfig = { readonly enabled: false; readonly singleTenantOrganizationId: string } | { readonly enabled: true };

/** The API's complete, validated configuration. Built once at startup. */
export interface ApiConfig {
	readonly runtime: RuntimeConfig;
	readonly http: HttpConfig;
	readonly clientApps: ClientAppsConfig;
	readonly database: DatabaseConfig;
	readonly auth: AuthConfig;
	readonly mfa: MfaConfig;
	readonly encryption: EncryptionConfig;
	readonly email: EmailConfig;
	readonly rateLimits: RateLimitConfig;
	readonly caches: CacheConfig;
	readonly messaging: MessagingConfig;
	readonly storage: StorageConfig;
	readonly observability: ObservabilityConfig;
	readonly tenancy: TenancyConfig;
}

// ── Derivations ────────────────────────────────────────────────────────────

/**
 * Docs exposure: `SWAGGER_ENABLED` when set, otherwise ON outside production
 * and OFF in production. Development/test docs are public; production docs
 * (when opted in) are gated to platform SuperAdmins (`ApiDocsAccessGate`).
 * Every endpoint still enforces authentication and authorization on its own
 * (docs/technical/api/routes.md §9).
 */
export function resolveApiDocsPolicy(swaggerEnabled: boolean | undefined, isProduction: boolean): ApiDocsPolicy {
	return { enabled: swaggerEnabled ?? !isProduction, access: isProduction ? "platform_admin" : "public" };
}

/** `auto` → redis outside development when Redis is configured, otherwise memory. */
/** Longest namespace RedisNamespaceEnvSchema accepts. */
const MAX_REDIS_NAMESPACE_LENGTH = 64;
/** Fallback slug when APP_NAME holds no letter or digit. */
const FALLBACK_REDIS_NAMESPACE_APP_SLUG = "api";

/**
 * The Redis namespace: `REDIS_NAMESPACE` when set, else `<app-name-slug>:<NODE_ENV>`
 * (e.g. `nestjs-nextjs-turborepo-starter-template:development`). The default is
 * deterministic, so every instance of one deployment agrees on it without
 * extra config; deployments that share a Redis with the same APP_NAME and
 * NODE_ENV (two local APIs on different databases, staging next to
 * production) MUST set REDIS_NAMESPACE explicitly — e2e and ci:local runs do,
 * per run.
 */
export function resolveRedisNamespace(configured: string | undefined, appName: string, nodeEnv: NodeEnv): string {
	if (configured !== undefined) {
		return configured;
	}
	const slug: string = appName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	const appSlug: string = (slug === "" ? FALLBACK_REDIS_NAMESPACE_APP_SLUG : slug).slice(0, MAX_REDIS_NAMESPACE_LENGTH - nodeEnv.length - 1).replace(/-+$/, "");
	return `${appSlug}:${nodeEnv}`;
}

/** The configured LOG_LEVEL, or the environment's default ({@link DEFAULT_LOG_LEVEL_BY_NODE_ENV}). */
export function resolveLogLevel(configured: LogLevel | undefined, nodeEnv: NodeEnv): LogLevel {
	return configured ?? DEFAULT_LOG_LEVEL_BY_NODE_ENV[nodeEnv];
}

export function resolveCacheBackend(setting: CacheBackendSetting, nodeEnv: NodeEnv, redisUrl: string | undefined): CacheBackend {
	if (setting !== "auto") {
		return setting;
	}
	return nodeEnv !== NodeEnvSchema.enum.development && redisUrl !== undefined ? "redis" : "memory";
}

/** First configured private container, in precedence order (neutral name first, legacy aliases after). */
function configuredPrivateContainer(env: ApiEnv): string | undefined {
	return env.STORAGE_PRIVATE_CONTAINER ?? env.STORAGE_S3_PRIVATE_BUCKET ?? env.STORAGE_S3_BUCKET ?? env.FIREBASE_STORAGE_BUCKET;
}

/** Configured public container (neutral name first, legacy S3 alias after). */
function configuredPublicContainer(env: ApiEnv): string | undefined {
	return env.STORAGE_PUBLIC_CONTAINER ?? env.STORAGE_S3_PUBLIC_BUCKET;
}

/** Explicit `STORAGE_PROVIDER`, else `s3` when a real (non `local-*`) S3 bucket is configured, else `local`. */
export function resolveStorageProvider(env: ApiEnv): StorageProviderSetting {
	if (env.STORAGE_PROVIDER !== undefined) {
		return env.STORAGE_PROVIDER;
	}
	const legacyBucket: string | undefined = env.STORAGE_S3_PRIVATE_BUCKET ?? env.STORAGE_S3_BUCKET;
	return legacyBucket !== undefined && !legacyBucket.startsWith(LOCAL_CONTAINER_PREFIX) ? "s3" : "local";
}

function resolveMalwareScannerConfig(env: ApiEnv): MalwareScannerConfig {
	return { kind: env.MALWARE_SCANNER };
}

function resolveObserveConfig(env: ApiEnv): ObserveConfig | null {
	const enabled: boolean = env.OBSERVE_ENABLED ?? env.NODE_ENV === NodeEnvSchema.enum.production;
	if (!enabled || env.OBSERVE_APP_KEY === undefined || env.OBSERVE_APP_SECRET === undefined) {
		return null;
	}
	return { appKey: env.OBSERVE_APP_KEY, appSecret: env.OBSERVE_APP_SECRET, serviceId: env.OBSERVE_SERVICE_ID };
}

// ── Cross-field rules ──────────────────────────────────────────────────────

/** Signing secrets that must all differ, so one leak cannot forge another token type. */
type DistinctSecretKey = "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET" | "EMAIL_VERIFICATION_SECRET" | "TWO_FACTOR_PENDING_SECRET";

function requireDistinctSecrets(env: ApiEnv, context: z.RefinementCtx<ApiEnv>): void {
	const secrets: readonly (readonly [DistinctSecretKey, string])[] = [
		["JWT_ACCESS_SECRET", env.JWT_ACCESS_SECRET],
		["JWT_REFRESH_SECRET", env.JWT_REFRESH_SECRET],
		["EMAIL_VERIFICATION_SECRET", env.EMAIL_VERIFICATION_SECRET],
		["TWO_FACTOR_PENDING_SECRET", env.TWO_FACTOR_PENDING_SECRET],
	];
	const seen = new Map<string, DistinctSecretKey>();
	for (const [key, value] of secrets) {
		const previous: DistinctSecretKey | undefined = seen.get(value);
		if (previous !== undefined) {
			context.addIssue({ code: "custom", path: [key], message: `must differ from ${previous}` });
			continue;
		}
		seen.set(value, key);
	}
}

/** Host names that only ever mean "this machine". */
const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * Whether a URL points at the local machine (`localhost`, `*.localhost`,
 * 127.0.0.1, ::1). A production build whose `APP_URL` is loopback is someone
 * running the production bundle on their own machine, not a deployment.
 */
export function isLoopbackUrl(url: string): boolean {
	const hostname = new URL(url).hostname.toLowerCase();
	return LOOPBACK_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost");
}

/**
 * A production build serving real users. A production build whose `APP_URL`
 * is loopback is someone running the bundle on their own machine.
 */
function isDeployedProduction(env: ApiEnv): boolean {
	return env.NODE_ENV === NodeEnvSchema.enum.production && !isLoopbackUrl(env.APP_URL);
}

function checkStorageRules(env: ApiEnv, context: z.RefinementCtx<ApiEnv>): void {
	const provider: StorageProviderSetting = resolveStorageProvider(env);
	if (provider !== "local" && configuredPrivateContainer(env) === undefined) {
		context.addIssue({
			code: "custom",
			path: ["STORAGE_PRIVATE_CONTAINER"],
			message: `is required when STORAGE_PROVIDER=${provider} (or set a provider alias: STORAGE_S3_PRIVATE_BUCKET, STORAGE_S3_BUCKET, FIREBASE_STORAGE_BUCKET)`,
		});
	}
	// The local driver keeps objects on one machine's disk and serves them
	// through the API process: no durability, no replication, no CDN.
	if (provider === "local" && isDeployedProduction(env)) {
		context.addIssue({
			code: "custom",
			path: ["STORAGE_PROVIDER"],
			message: "must be s3 or firebase on a deployed production environment (local disk storage is only allowed when APP_URL is localhost)",
		});
	}
	if (provider === "s3") {
		checkS3PublicDeliveryRules(env, context);
	}
}

/**
 * S3 serves public assets (product images, logos, avatars) from a separate
 * public-origin bucket behind CloudFront: the API copies each READY public
 * object there and links to `https://<STORAGE_CLOUDFRONT_PUBLIC_DOMAIN>/<key>`.
 * Both halves are required — without them a public URL would point at a
 * bucket that blocks public access. The distribution id is required too: a
 * withdrawn asset is purged from the CloudFront cache, not left until its TTL.
 */
function checkS3PublicDeliveryRules(env: ApiEnv, context: z.RefinementCtx<ApiEnv>): void {
	const publicContainer: string | undefined = configuredPublicContainer(env);
	if (publicContainer === undefined) {
		context.addIssue({
			code: "custom",
			path: ["STORAGE_PUBLIC_CONTAINER"],
			message: "is required when STORAGE_PROVIDER=s3: the public-origin bucket CloudFront serves (or set the alias STORAGE_S3_PUBLIC_BUCKET)",
		});
	} else if (publicContainer === configuredPrivateContainer(env)) {
		context.addIssue({
			code: "custom",
			path: ["STORAGE_PUBLIC_CONTAINER"],
			message: "must differ from the private container: public assets are published to their own CloudFront origin bucket",
		});
	}
	if (env.STORAGE_CLOUDFRONT_PUBLIC_DOMAIN === undefined) {
		context.addIssue({
			code: "custom",
			path: ["STORAGE_CLOUDFRONT_PUBLIC_DOMAIN"],
			message: "is required when STORAGE_PROVIDER=s3: public asset URLs are served through CloudFront",
		});
	}
	if (env.STORAGE_CLOUDFRONT_DISTRIBUTION_ID === undefined) {
		context.addIssue({
			code: "custom",
			path: ["STORAGE_CLOUDFRONT_DISTRIBUTION_ID"],
			message: "is required when STORAGE_PROVIDER=s3: deleted public assets are purged from this CloudFront distribution's cache",
		});
	}
}

/** Variables that hold long-lived (static) AWS credentials. */
const STATIC_AWS_KEY_VARIABLES: readonly ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"] = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"];

/**
 * AWS credentials come from an IAM role through the SDK's default credential
 * chain (ECS task role, EC2 instance profile, EKS IRSA / Pod Identity). Static
 * access keys are a local-development convenience only: on a deployed
 * production environment they are rejected outright, and anywhere else they
 * must come as a complete pair.
 */
function checkAwsCredentialRules(env: ApiEnv, context: z.RefinementCtx<ApiEnv>): void {
	if (isDeployedProduction(env)) {
		for (const variable of STATIC_AWS_KEY_VARIABLES) {
			if (env[variable] !== undefined) {
				context.addIssue({
					code: "custom",
					path: [variable],
					message:
						"must not be set on a deployed production environment: the API authenticates to AWS with an IAM role (ECS task role, EC2 instance profile or EKS IRSA) through the AWS SDK default credential chain; static access keys are only allowed when APP_URL is localhost",
				});
			}
		}
		return;
	}
	if ((env.AWS_ACCESS_KEY_ID === undefined) !== (env.AWS_SECRET_ACCESS_KEY === undefined)) {
		const missing: keyof ApiEnv = env.AWS_ACCESS_KEY_ID === undefined ? "AWS_ACCESS_KEY_ID" : "AWS_SECRET_ACCESS_KEY";
		context.addIssue({
			code: "custom",
			path: [missing],
			message:
				"must be set together with its AWS key pair counterpart for local development (or leave both unset so the AWS SDK default credential chain resolves an SSO profile or IAM role)",
		});
	}
}

/** Cross-field rules. Each issue names the variable to fix and never echoes a value. */
export function checkApiEnvRules(env: ApiEnv, context: z.RefinementCtx<ApiEnv>): void {
	const isProduction: boolean = env.NODE_ENV === NodeEnvSchema.enum.production;

	requireDistinctSecrets(env, context);
	if (!env.TENANCY_ENABLED && env.DEFAULT_ORGANIZATION_ID === undefined) {
		context.addIssue({
			code: "custom",
			path: ["DEFAULT_ORGANIZATION_ID"],
			message: "is required in single-tenant mode (TENANCY_ENABLED off): the id of the organization this deployment serves (`pnpm db:seed` creates one)",
		});
	}

	for (const issue of listKafkaSecurityEnvIssues(env)) {
		context.addIssue({ code: "custom", path: [issue.variable], message: issue.message });
	}

	if (env.EMAIL_MODE === "send" && env.RESEND_API_KEY === undefined) {
		context.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "is required when EMAIL_MODE=send (set EMAIL_MODE=log-only or noop to run without Resend)" });
	}
	// A deployed production API must really deliver email: `log-only` would
	// print one-time codes and reset links into the log, and `noop` would
	// report fake "sent" results to every caller.
	const isDeployedProduction: boolean = isProduction && !isLoopbackUrl(env.APP_URL);
	if (isDeployedProduction && env.EMAIL_MODE !== "send") {
		context.addIssue({
			code: "custom",
			path: ["EMAIL_MODE"],
			message: "must be send on a deployed production environment (log-only writes codes and links to the log, noop fakes delivery)",
		});
	}
	// Without the signing secret every Resend delivery webhook is rejected, so
	// bounces and complaints would never reach the email log.
	if (isDeployedProduction && env.EMAIL_MODE === "send" && env.RESEND_WEBHOOK_SECRET === undefined) {
		context.addIssue({
			code: "custom",
			path: ["RESEND_WEBHOOK_SECRET"],
			message: "is required on a deployed production environment with EMAIL_MODE=send (delivery webhooks cannot be verified without it)",
		});
	}
	if (isProduction && env.LOGIN_VERIFICATION_MODE === "disabled") {
		context.addIssue({
			code: "custom",
			path: ["LOGIN_VERIFICATION_MODE"],
			message: "must not switch login verification off in production (new-device verification protects stolen passwords)",
		});
	}
	// EMAIL_TEST_TO redirects every outbound email to one inbox: right for local
	// development (including a production build run on localhost), a silent
	// outage for real users on a deployed environment.
	if (isProduction && env.EMAIL_TEST_TO !== undefined && !isLoopbackUrl(env.APP_URL)) {
		context.addIssue({
			code: "custom",
			path: ["EMAIL_TEST_TO"],
			message: "must not be set on a deployed production environment (it redirects every outbound email to one inbox); it is only allowed when APP_URL is localhost",
		});
	}
	if (isProduction && env.TENANT_KMS_PROVIDER === undefined) {
		context.addIssue({
			code: "custom",
			path: ["TENANT_KMS_PROVIDER"],
			message: "is required in production — choose the provider that wraps tenant data keys explicitly (`local` keeps the key-encryption key in this environment)",
		});
	}
	for (const retiredVersion of Object.keys(env.TENANT_ENCRYPTION_PREVIOUS_MASTER_KEYS ?? {})) {
		if (Number(retiredVersion) >= env.TENANT_ENCRYPTION_MASTER_KEY_VERSION) {
			context.addIssue({
				code: "custom",
				path: ["TENANT_ENCRYPTION_PREVIOUS_MASTER_KEYS"],
				message: "may only hold versions lower than TENANT_ENCRYPTION_MASTER_KEY_VERSION (the current key)",
			});
		}
	}
	if (isProduction && env.REDIS_URL === undefined) {
		context.addIssue({ code: "custom", path: ["REDIS_URL"], message: "is required in production (distributed caches, rate limits and BullMQ need Redis)" });
	}
	checkAwsCredentialRules(env, context);
	if (env.OBSERVE_ENABLED === true && (env.OBSERVE_APP_KEY === undefined || env.OBSERVE_APP_SECRET === undefined)) {
		const missing: keyof ApiEnv = env.OBSERVE_APP_KEY === undefined ? "OBSERVE_APP_KEY" : "OBSERVE_APP_SECRET";
		context.addIssue({ code: "custom", path: [missing], message: "is required when OBSERVE_ENABLED is on" });
	}
	checkStorageRules(env, context);
}

// ── Grouping ───────────────────────────────────────────────────────────────

/** Single-tenant mode with its organization id (guaranteed by {@link checkApiEnvRules}), or multi-tenant mode. */
function resolveTenancy(env: ApiEnv): TenancyConfig {
	if (env.TENANCY_ENABLED) {
		return { enabled: true };
	}
	if (env.DEFAULT_ORGANIZATION_ID === undefined) {
		throw new Error("DEFAULT_ORGANIZATION_ID is required in single-tenant mode (checkApiEnvRules enforces this)");
	}
	return { enabled: false, singleTenantOrganizationId: env.DEFAULT_ORGANIZATION_ID };
}

/** Groups the validated flat environment into the typed `ApiConfig`. */
export function toApiConfig(env: ApiEnv): ApiConfig {
	const nodeEnv: NodeEnv = env.NODE_ENV;
	const isProduction: boolean = nodeEnv === NodeEnvSchema.enum.production;
	const provider: StorageProviderSetting = resolveStorageProvider(env);

	return {
		runtime: {
			nodeEnv,
			isProduction,
			isDevelopment: nodeEnv === NodeEnvSchema.enum.development,
			isTest: nodeEnv === NodeEnvSchema.enum.test,
			appName: env.APP_NAME,
		},
		http: {
			host: env.HOST,
			port: env.PORT,
			publicUrl: env.API_PUBLIC_URL ?? `http://${env.HOST}:${String(env.PORT)}`,
			trustedProxies: env.TRUST_PROXY,
			corsOrigins: env.CORS_ORIGINS,
			cookieDomain: env.COOKIE_DOMAIN,
			securityHardeningEnabled: env.SECURITY_HARDENING_ENABLED ?? isProduction,
			apiDocs: resolveApiDocsPolicy(env.SWAGGER_ENABLED, isProduction),
			shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
		},
		clientApps: { webUrl: env.APP_URL, adminUrl: env.ADMIN_APP_URL, merchantUrl: env.MERCHANT_APP_URL },
		database: { url: env.DATABASE_URL, poolMax: env.DB_POOL_MAX, idleTimeoutMs: env.DB_IDLE_TIMEOUT_MS, allowExitOnIdle: !isProduction },
		auth: {
			jwtAccessSecret: env.JWT_ACCESS_SECRET,
			jwtAccessExpiry: env.JWT_ACCESS_EXPIRY,
			jwtRefreshSecret: env.JWT_REFRESH_SECRET,
			jwtRefreshExpiry: env.JWT_REFRESH_EXPIRY,
			emailVerificationSecret: env.EMAIL_VERIFICATION_SECRET,
			twoFactorPendingSecret: env.TWO_FACTOR_PENDING_SECRET,
			twoFactorIssuer: env.TWO_FACTOR_ISSUER ?? env.APP_NAME,
			loginVerificationMode: env.LOGIN_VERIFICATION_MODE,
			bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
		},
		mfa: {
			encryptionKeys: env.MFA_ENCRYPTION_KEYS,
			enrollmentDeadlineMs: env.MFA_ENROLLMENT_DEADLINE_MS,
			recoveryDelayMs: env.MFA_RECOVERY_DELAY_MS,
			stepUpTtlMs: env.MFA_STEP_UP_TTL_MS,
		},
		encryption: {
			tenantMasterKey: env.TENANT_ENCRYPTION_MASTER_KEY,
			tenantMasterKeyVersion: env.TENANT_ENCRYPTION_MASTER_KEY_VERSION,
			tenantPreviousMasterKeys: env.TENANT_ENCRYPTION_PREVIOUS_MASTER_KEYS ?? {},
			tenantKmsProvider: env.TENANT_KMS_PROVIDER ?? NON_PRODUCTION_TENANT_KMS_PROVIDER,
			tenantJobHmacSecret: env.TENANT_JOB_HMAC_SECRET ?? null,
			rewardCodeHashKeys: env.REWARD_CODE_HASH_KEYS,
		},
		email: {
			mode: env.EMAIL_MODE,
			resendApiKey: env.RESEND_API_KEY ?? null,
			fromAddress: env.EMAIL_FROM_ADDRESS,
			replyTo: env.EMAIL_REPLY_TO,
			testTo: env.EMAIL_TEST_TO,
			maxAttempts: env.EMAIL_MAX_ATTEMPTS,
			timeoutMs: env.EMAIL_TIMEOUT_MS,
			rateLimitPerMinute: env.EMAIL_RATE_LIMIT_PER_MINUTE,
			resendWebhookSecret: env.RESEND_WEBHOOK_SECRET ?? null,
			webhookRateLimitPerMinute: env.WEBHOOK_RATE_LIMIT_PER_MINUTE,
		},
		rateLimits: {
			throttleDefaultLimit: env.THROTTLE_DEFAULT_LIMIT,
			throttleStrictLimit: env.THROTTLE_STRICT_LIMIT,
			throttleTtlMs: env.THROTTLE_TTL_MS,
			securityCounterMaxKeys: env.SECURITY_COUNTER_MAX_KEYS,
		},
		caches: {
			authorizationBackend: resolveCacheBackend(env.AUTHORIZATION_CACHE_BACKEND, nodeEnv, env.REDIS_URL),
			authorizationTtlMs: env.AUTHORIZATION_CACHE_TTL_MS,
			authorizationMaxEntries: env.AUTHORIZATION_CACHE_MAX_ENTRIES,
			userSessionBackend: resolveCacheBackend(env.USER_SESSION_CACHE_BACKEND, nodeEnv, env.REDIS_URL),
			userSessionTtlMs: env.USER_SESSION_CACHE_TTL_MS,
			userSessionMaxEntries: env.USER_SESSION_CACHE_MAX_ENTRIES,
			accessTokenStateTtlMs: env.ACCESS_TOKEN_STATE_CACHE_TTL_MS,
			accessTokenStateMaxEntries: env.ACCESS_TOKEN_STATE_CACHE_MAX_ENTRIES,
		},
		messaging: {
			redisUrl: env.REDIS_URL,
			kafkaBrokers: env.KAFKA_BROKERS,
			kafkaSecurity: toKafkaSecurityOptions(env),
			kafkaDeliveryTimeoutMs: env.KAFKA_DELIVERY_TIMEOUT_MS,
			rabbitmqUrl: env.RABBITMQ_URL,
			clientId: env.MESSAGING_CLIENT_ID,
			connectionName: env.MESSAGING_CONNECTION_NAME,
			bullPrefix: env.BULLMQ_PREFIX,
			redisNamespace: resolveRedisNamespace(env.REDIS_NAMESPACE, env.APP_NAME, nodeEnv),
		},
		storage: {
			provider,
			privateContainer: configuredPrivateContainer(env) ?? LOCAL_PRIVATE_CONTAINER,
			publicContainer: configuredPublicContainer(env) ?? LOCAL_PUBLIC_CONTAINER,
			firebaseProjectId: env.FIREBASE_PROJECT_ID ?? null,
			firebaseStorageBucket: env.FIREBASE_STORAGE_BUCKET ?? null,
			cloudfrontPublicDomain: env.STORAGE_CLOUDFRONT_PUBLIC_DOMAIN ?? null,
			cloudfrontDistributionId: env.STORAGE_CLOUDFRONT_DISTRIBUTION_ID ?? null,
			awsRegion: env.AWS_REGION,
			downloadTtlSeconds: env.STORAGE_DOWNLOAD_TTL_SECONDS ?? env.KYB_DOCUMENT_DOWNLOAD_TTL_SECONDS ?? DEFAULT_STORAGE_DOWNLOAD_TTL_SECONDS,
			physicalDeleteDelayMs:
				env.STORAGE_PHYSICAL_DELETE_DELAY_MS ?? (isProduction ? PRODUCTION_STORAGE_PHYSICAL_DELETE_DELAY_MS : NON_PRODUCTION_STORAGE_PHYSICAL_DELETE_DELAY_MS),
			processingCallbackSecret: env.STORAGE_PROCESSING_CALLBACK_SECRET ?? null,
			malwareScanner: resolveMalwareScannerConfig(env),
		},
		observability: {
			logLevel: resolveLogLevel(env.LOG_LEVEL, nodeEnv),
			memoryMonitoring: isProduction || env.MEMORY_MONITORING,
			memoryLeakDetection: {
				warmupMs: env.MEMORY_LEAK_WARMUP_MS,
				windowMs: env.MEMORY_LEAK_WINDOW_MS,
				growthThresholdMb: env.MEMORY_LEAK_GROWTH_THRESHOLD_MB,
			},
			observe: resolveObserveConfig(env),
		},
		tenancy: resolveTenancy(env),
	};
}

/** Flat env → validated → cross-checked → grouped. */
export const ApiEnvSchema = ApiEnvInputSchema.superRefine(checkApiEnvRules).transform(toApiConfig);
