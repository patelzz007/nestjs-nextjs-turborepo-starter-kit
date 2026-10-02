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
// See docs/api-configuration.md.

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
import { z } from "zod";

import {
	Aes256KeyEnvSchema,
	AmqpUrlEnvSchema,
	CacheBackendSettingSchema,
	CorsOriginsEnvSchema,
	EmailModeSchema,
	jwtExpiryEnvSchema,
	LogLevelSchema,
	MfaEncryptionKeysEnvSchema,
	NonEmptyEnvStringSchema,
	OptionalToggleEnvSchema,
	RedisUrlEnvSchema,
	SecretEnvSchema,
	StorageProviderSettingSchema,
	ToggleEnvSchema,
	type CacheBackend,
	type CacheBackendSetting,
	type EmailMode,
	type LogLevel,
	type StorageProviderSetting,
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

const DEFAULT_LOG_LEVEL: LogLevel = "warn";
const DEFAULT_OBSERVE_SERVICE_ID = "freebuff-api";
const DEFAULT_MESSAGING_CLIENT_ID = "hello-world-api";
const DEFAULT_DEFAULT_ORGANIZATION_ID = "default";

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
	TRUST_PROXY: ToggleEnvSchema,
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
	FORCE_LOGIN_VERIFICATION: BooleanFlagEnvSchema,
	BCRYPT_SALT_ROUNDS: integerEnvSchema({ min: MIN_BCRYPT_SALT_ROUNDS, max: MAX_BCRYPT_SALT_ROUNDS, defaultValue: DEFAULT_BCRYPT_SALT_ROUNDS }),

	// MFA / encryption
	MFA_ENCRYPTION_KEYS: MfaEncryptionKeysEnvSchema,
	MFA_ENROLLMENT_DEADLINE_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_MFA_ENROLLMENT_DEADLINE_MS }),
	MFA_RECOVERY_DELAY_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_MFA_RECOVERY_DELAY_MS }),
	MFA_STEP_UP_TTL_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_MFA_STEP_UP_TTL_MS }),
	TENANT_ENCRYPTION_MASTER_KEY: Aes256KeyEnvSchema,
	TENANT_JOB_HMAC_SECRET: SecretEnvSchema.optional(),

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

	// Object storage
	STORAGE_PROVIDER: StorageProviderSettingSchema.optional(),
	STORAGE_PRIVATE_CONTAINER: NonEmptyEnvStringSchema.optional(),
	STORAGE_PUBLIC_CONTAINER: NonEmptyEnvStringSchema.optional(),
	STORAGE_S3_BUCKET: NonEmptyEnvStringSchema.optional(),
	STORAGE_S3_PRIVATE_BUCKET: NonEmptyEnvStringSchema.optional(),
	STORAGE_S3_PUBLIC_BUCKET: NonEmptyEnvStringSchema.optional(),
	STORAGE_CLOUDFRONT_PUBLIC_DOMAIN: NonEmptyEnvStringSchema.optional(),
	FIREBASE_PROJECT_ID: NonEmptyEnvStringSchema.optional(),
	FIREBASE_STORAGE_BUCKET: NonEmptyEnvStringSchema.optional(),
	AWS_REGION: NonEmptyEnvStringSchema.default(DEFAULT_AWS_REGION),
	AWS_ACCESS_KEY_ID: NonEmptyEnvStringSchema.optional(),
	AWS_SECRET_ACCESS_KEY: NonEmptyEnvStringSchema.optional(),
	STORAGE_DOWNLOAD_TTL_SECONDS: optionalIntegerEnvSchema({ min: 1 }),
	KYB_DOCUMENT_DOWNLOAD_TTL_SECONDS: optionalIntegerEnvSchema({ min: 1 }),
	STORAGE_PHYSICAL_DELETE_DELAY_MS: optionalIntegerEnvSchema({ min: 1 }),
	STORAGE_PROCESSING_CALLBACK_SECRET: SecretEnvSchema.optional(),

	// Observability
	LOG_LEVEL: LogLevelSchema.default(DEFAULT_LOG_LEVEL),
	MEMORY_MONITORING: BooleanFlagEnvSchema,
	OBSERVE_ENABLED: OptionalToggleEnvSchema,
	OBSERVE_APP_KEY: NonEmptyEnvStringSchema.optional(),
	OBSERVE_APP_SECRET: NonEmptyEnvStringSchema.optional(),
	OBSERVE_SERVICE_ID: NonEmptyEnvStringSchema.default(DEFAULT_OBSERVE_SERVICE_ID),

	// Tenancy
	TENANCY_ENABLED: BooleanFlagEnvSchema,
	DEFAULT_ORGANIZATION_ID: NonEmptyEnvStringSchema.default(DEFAULT_DEFAULT_ORGANIZATION_ID),
});

/** The validated flat environment, before grouping. */
export type ApiEnv = z.output<typeof ApiEnvInputSchema>;

// ── Grouped output ─────────────────────────────────────────────────────────

/** Whether the Swagger docs are mounted. When mounted they are public — no authentication. */
export interface ApiDocsPolicy {
	readonly enabled: boolean;
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
	readonly trustProxy: boolean;
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
	readonly forceLoginVerification: boolean;
	readonly bcryptSaltRounds: number;
}

export interface MfaConfig {
	readonly encryptionKeys: Readonly<Record<number, string>>;
	readonly enrollmentDeadlineMs: number;
	readonly recoveryDelayMs: number;
	readonly stepUpTtlMs: number;
}

export interface EncryptionConfig {
	/** Base64 of exactly 32 bytes — wraps every tenant data key. */
	readonly tenantMasterKey: string;
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
	readonly rabbitmqUrl: string | undefined;
	readonly clientId: string;
	readonly connectionName: string;
}

export interface StorageConfig {
	readonly provider: StorageProviderSetting;
	readonly privateContainer: string;
	readonly publicContainer: string;
	readonly firebaseProjectId: string | null;
	readonly firebaseStorageBucket: string | null;
	readonly cloudfrontPublicDomain: string | null;
	readonly awsRegion: string;
	readonly awsAccessKeyId: string | null;
	readonly awsSecretAccessKey: string | null;
	readonly downloadTtlSeconds: number;
	readonly physicalDeleteDelayMs: number;
	readonly processingCallbackSecret: string | null;
}

export interface ObserveConfig {
	readonly appKey: string;
	readonly appSecret: string;
	readonly serviceId: string;
}

export interface ObservabilityConfig {
	readonly logLevel: LogLevel;
	readonly memoryMonitoring: boolean;
	/** `null` when NestJS Observe is off. */
	readonly observe: ObserveConfig | null;
}

export interface TenancyConfig {
	readonly enabled: boolean;
	readonly defaultOrganizationId: string;
}

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
 * Docs exposure: ON in every environment unless `SWAGGER_ENABLED` turns it
 * off, and always PUBLIC. The docs describe the contract, not data: every
 * endpoint still enforces authentication and authorization on its own, so
 * hiding the description behind a login protects nothing (docs/api-routes.md).
 */
export function resolveApiDocsPolicy(swaggerEnabled: boolean | undefined): ApiDocsPolicy {
	return { enabled: swaggerEnabled ?? true };
}

/** `auto` → redis outside development when Redis is configured, otherwise memory. */
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

/** Explicit `STORAGE_PROVIDER`, else `s3` when a real (non `local-*`) S3 bucket is configured, else `local`. */
export function resolveStorageProvider(env: ApiEnv): StorageProviderSetting {
	if (env.STORAGE_PROVIDER !== undefined) {
		return env.STORAGE_PROVIDER;
	}
	const legacyBucket: string | undefined = env.STORAGE_S3_PRIVATE_BUCKET ?? env.STORAGE_S3_BUCKET;
	return legacyBucket !== undefined && !legacyBucket.startsWith(LOCAL_CONTAINER_PREFIX) ? "s3" : "local";
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

/** Cross-field rules. Each issue names the variable to fix and never echoes a value. */
export function checkApiEnvRules(env: ApiEnv, context: z.RefinementCtx<ApiEnv>): void {
	const isProduction: boolean = env.NODE_ENV === NodeEnvSchema.enum.production;

	requireDistinctSecrets(env, context);

	if (env.EMAIL_MODE === "send" && env.RESEND_API_KEY === undefined) {
		context.addIssue({ code: "custom", path: ["RESEND_API_KEY"], message: "is required when EMAIL_MODE=send (set EMAIL_MODE=log-only or noop to run without Resend)" });
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
	if (isProduction && env.REDIS_URL === undefined) {
		context.addIssue({ code: "custom", path: ["REDIS_URL"], message: "is required in production (distributed caches, rate limits and BullMQ need Redis)" });
	}
	if ((env.AWS_ACCESS_KEY_ID === undefined) !== (env.AWS_SECRET_ACCESS_KEY === undefined)) {
		const missing: keyof ApiEnv = env.AWS_ACCESS_KEY_ID === undefined ? "AWS_ACCESS_KEY_ID" : "AWS_SECRET_ACCESS_KEY";
		context.addIssue({
			code: "custom",
			path: [missing],
			message: "must be set together with its AWS key pair counterpart (or leave both unset to use the default credential chain)",
		});
	}
	if (env.OBSERVE_ENABLED === true && (env.OBSERVE_APP_KEY === undefined || env.OBSERVE_APP_SECRET === undefined)) {
		const missing: keyof ApiEnv = env.OBSERVE_APP_KEY === undefined ? "OBSERVE_APP_KEY" : "OBSERVE_APP_SECRET";
		context.addIssue({ code: "custom", path: [missing], message: "is required when OBSERVE_ENABLED is on" });
	}
	const provider: StorageProviderSetting = resolveStorageProvider(env);
	if (provider !== "local" && configuredPrivateContainer(env) === undefined) {
		context.addIssue({
			code: "custom",
			path: ["STORAGE_PRIVATE_CONTAINER"],
			message: `is required when STORAGE_PROVIDER=${provider} (or set a provider alias: STORAGE_S3_PRIVATE_BUCKET, STORAGE_S3_BUCKET, FIREBASE_STORAGE_BUCKET)`,
		});
	}
}

// ── Grouping ───────────────────────────────────────────────────────────────

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
			trustProxy: env.TRUST_PROXY,
			corsOrigins: env.CORS_ORIGINS,
			cookieDomain: env.COOKIE_DOMAIN,
			securityHardeningEnabled: env.SECURITY_HARDENING_ENABLED ?? isProduction,
			apiDocs: resolveApiDocsPolicy(env.SWAGGER_ENABLED),
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
			forceLoginVerification: env.FORCE_LOGIN_VERIFICATION,
			bcryptSaltRounds: env.BCRYPT_SALT_ROUNDS,
		},
		mfa: {
			encryptionKeys: env.MFA_ENCRYPTION_KEYS,
			enrollmentDeadlineMs: env.MFA_ENROLLMENT_DEADLINE_MS,
			recoveryDelayMs: env.MFA_RECOVERY_DELAY_MS,
			stepUpTtlMs: env.MFA_STEP_UP_TTL_MS,
		},
		encryption: { tenantMasterKey: env.TENANT_ENCRYPTION_MASTER_KEY, tenantJobHmacSecret: env.TENANT_JOB_HMAC_SECRET ?? null },
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
			rabbitmqUrl: env.RABBITMQ_URL,
			clientId: env.MESSAGING_CLIENT_ID,
			connectionName: env.MESSAGING_CONNECTION_NAME,
		},
		storage: {
			provider,
			privateContainer: configuredPrivateContainer(env) ?? LOCAL_PRIVATE_CONTAINER,
			publicContainer: env.STORAGE_PUBLIC_CONTAINER ?? env.STORAGE_S3_PUBLIC_BUCKET ?? LOCAL_PUBLIC_CONTAINER,
			firebaseProjectId: env.FIREBASE_PROJECT_ID ?? null,
			firebaseStorageBucket: env.FIREBASE_STORAGE_BUCKET ?? null,
			cloudfrontPublicDomain: env.STORAGE_CLOUDFRONT_PUBLIC_DOMAIN ?? null,
			awsRegion: env.AWS_REGION,
			awsAccessKeyId: env.AWS_ACCESS_KEY_ID ?? null,
			awsSecretAccessKey: env.AWS_SECRET_ACCESS_KEY ?? null,
			downloadTtlSeconds: env.STORAGE_DOWNLOAD_TTL_SECONDS ?? env.KYB_DOCUMENT_DOWNLOAD_TTL_SECONDS ?? DEFAULT_STORAGE_DOWNLOAD_TTL_SECONDS,
			physicalDeleteDelayMs:
				env.STORAGE_PHYSICAL_DELETE_DELAY_MS ?? (isProduction ? PRODUCTION_STORAGE_PHYSICAL_DELETE_DELAY_MS : NON_PRODUCTION_STORAGE_PHYSICAL_DELETE_DELAY_MS),
			processingCallbackSecret: env.STORAGE_PROCESSING_CALLBACK_SECRET ?? null,
		},
		observability: {
			logLevel: env.LOG_LEVEL,
			memoryMonitoring: isProduction || env.MEMORY_MONITORING,
			observe: resolveObserveConfig(env),
		},
		tenancy: { enabled: env.TENANCY_ENABLED, defaultOrganizationId: env.DEFAULT_ORGANIZATION_ID },
	};
}

/** Flat env → validated → cross-checked → grouped. */
export const ApiEnvSchema = ApiEnvInputSchema.superRefine(checkApiEnvRules).transform(toApiConfig);
