// config/api-config/api-env.input.ts — The flat, variable-named input schema: one key per environment variable.
// Part of the API environment contract; `../api-config.schema.ts` is its public entry.

import {
	BooleanFlagEnvSchema,
	CookieDomainEnvSchema,
	HttpUrlEnvSchema,
	IanaTimeZoneSchema,
	integerEnvSchema,
	KafkaBrokersEnvSchema,
	NodeEnvSchema,
	optionalIntegerEnvSchema,
	PostgresUrlEnvSchema,
} from "@workspace/shared";
import { KafkaSecurityEnvShape } from "@workspace/messaging/kafka";
import { z } from "zod";

import { TrustProxyEnvSchema } from "../../platform/infrastructure/http/client-ip";
import {
	AppVersionEnvSchema,
	GithubRepositoriesEnvSchema,
	BullMqPrefixEnvSchema,
	RedisNamespaceEnvSchema,
	Aes256KeyEnvSchema,
	CdnHostEnvSchema,
	CloudFrontDistributionIdEnvSchema,
	AmqpUrlEnvSchema,
	CacheBackendSettingSchema,
	CorsOriginsEnvSchema,
	EmailModeSchema,
	EmailProviderSchema,
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
	TenantKmsProviderSchema,
	SessionLocationProviderSchema,
} from "../api-env.fields";
import {
	DEFAULT_ACCESS_TOKEN_STATE_CACHE_MAX_ENTRIES,
	DEFAULT_ACCESS_TOKEN_STATE_CACHE_TTL_MS,
	DEFAULT_AUTHORIZATION_CACHE_TTL_MS,
	DEFAULT_AWS_REGION,
	DEFAULT_BCRYPT_SALT_ROUNDS,
	DEFAULT_BULLMQ_PREFIX,
	DEFAULT_CACHE_MAX_ENTRIES,
	DEFAULT_DB_IDLE_TIMEOUT_MS,
	DEFAULT_DB_POOL_MAX,
	DEFAULT_EMAIL_ATTEMPTS,
	DEFAULT_EMAIL_TIMEOUT_MS,
	DEFAULT_GITHUB_CACHE_TTL_MS,
	DEFAULT_BACKUP_PG_DUMP_DOCKER_IMAGE,
	DEFAULT_EXECUTABLE_SEARCH_PATH,
	DEFAULT_GITHUB_REQUEST_TIMEOUT_MS,
	DEFAULT_HOST,
	DEFAULT_JWT_ACCESS_EXPIRY,
	DEFAULT_JWT_REFRESH_EXPIRY,
	DEFAULT_KAFKA_DELIVERY_TIMEOUT_MS,
	DEFAULT_MAILPIT_URL,
	DEFAULT_MEMORY_LEAK_GROWTH_THRESHOLD_MB,
	DEFAULT_MEMORY_LEAK_WARMUP_MS,
	DEFAULT_MEMORY_LEAK_WINDOW_MS,
	DEFAULT_TRANSACTION_LOG_DIR,
	DEFAULT_TRANSACTION_LOG_RETENTION_DAYS,
	DEFAULT_MESSAGING_CLIENT_ID,
	DEFAULT_MFA_ENROLLMENT_DEADLINE_MS,
	DEFAULT_MFA_RECOVERY_DELAY_MS,
	DEFAULT_MFA_STEP_UP_TTL_MS,
	DEFAULT_MOBILE_MIN_SUPPORTED_VERSION,
	DEFAULT_OBSERVE_SERVICE_ID,
	DEFAULT_PORT,
	DEFAULT_SECURITY_COUNTER_MAX_KEYS,
	DEFAULT_SESSION_LOCATION_TIMEOUT_MS,
	DEFAULT_SHUTDOWN_TIMEOUT_MS,
	DEFAULT_TENANT_MASTER_KEY_VERSION,
	DEFAULT_THROTTLE_DEFAULT_LIMIT,
	DEFAULT_THROTTLE_STRICT_LIMIT,
	DEFAULT_THROTTLE_TTL_MS,
	DEFAULT_USER_SESSION_CACHE_TTL_MS,
	DEFAULT_WEBHOOK_RATE_LIMIT_PER_MINUTE,
	GITHUB_WEBHOOK_SECRET_MIN_LENGTH,
	MAX_BCRYPT_SALT_ROUNDS,
	MAX_EMAIL_ATTEMPTS,
	MAX_GITHUB_CACHE_TTL_MS,
	MAX_GITHUB_REQUEST_TIMEOUT_MS,
	MAX_SESSION_LOCATION_TIMEOUT_MS,
	MAX_TCP_PORT,
	MIN_BCRYPT_SALT_ROUNDS,
	MIN_EMAIL_TIMEOUT_MS,
	MIN_KAFKA_DELIVERY_TIMEOUT_MS,
	MIN_MEMORY_LEAK_WINDOW_MS,
	MIN_THROTTLE_TTL_MS,
} from "./api-config.defaults";

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
	DB_POOL_MAX: integerEnvSchema({ min: 2, defaultValue: DEFAULT_DB_POOL_MAX }),
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

	// Mobile app (ADR 033)
	MOBILE_MIN_SUPPORTED_VERSION: AppVersionEnvSchema.default(DEFAULT_MOBILE_MIN_SUPPORTED_VERSION),

	// Device sessions (docs/technical/mobile/mobile-app.md §8.7)
	SESSION_LOCATION_PROVIDER: SessionLocationProviderSchema.default("none"),
	SESSION_LOCATION_TIMEOUT_MS: integerEnvSchema({ min: 1, max: MAX_SESSION_LOCATION_TIMEOUT_MS, defaultValue: DEFAULT_SESSION_LOCATION_TIMEOUT_MS }),

	// GitHub contributions (docs/technical/github-contributions.md)
	GITHUB_TOKEN: NonEmptyEnvStringSchema.optional(),
	GITHUB_REPOSITORIES: GithubRepositoriesEnvSchema.optional(),
	GITHUB_REQUEST_TIMEOUT_MS: integerEnvSchema({ min: 1, max: MAX_GITHUB_REQUEST_TIMEOUT_MS, defaultValue: DEFAULT_GITHUB_REQUEST_TIMEOUT_MS }),
	GITHUB_CACHE_TTL_MS: integerEnvSchema({ min: 1, max: MAX_GITHUB_CACHE_TTL_MS, defaultValue: DEFAULT_GITHUB_CACHE_TTL_MS }),
	// GitHub pull requests with each admin's own token (docs/adr/052-github-pull-requests.md)
	GITHUB_CREDENTIAL_ENCRYPTION_KEYS: MfaEncryptionKeysEnvSchema.optional(),
	// Live pull-request updates: GitHub's webhook receiver, as GitHub must reach it, and the shared secret it signs with.
	GITHUB_WEBHOOK_URL: HttpUrlEnvSchema.optional(),
	GITHUB_WEBHOOK_SECRET: z
		.string()
		.min(GITHUB_WEBHOOK_SECRET_MIN_LENGTH, { error: `must be at least ${String(GITHUB_WEBHOOK_SECRET_MIN_LENGTH)} characters (openssl rand -hex 32)` })
		.optional(),

	// Operations console (docs/adr/068-platform-operations-console.md)
	// Each cloud's read-only API token: the console shows that provider's view of its servers.
	DIGITALOCEAN_TOKEN: NonEmptyEnvStringSchema.optional(),
	LINODE_TOKEN: NonEmptyEnvStringSchema.optional(),
	VULTR_API_KEY: NonEmptyEnvStringSchema.optional(),
	HCLOUD_TOKEN: NonEmptyEnvStringSchema.optional(),
	// The backup's own read-only login (BYPASSRLS; `pnpm --filter @workspace/api db:provision-backup-login`).
	BACKUP_DATABASE_URL: PostgresUrlEnvSchema.optional(),
	// The image `pg_dump` runs from when the installed one is older than the server.
	BACKUP_PG_DUMP_DOCKER_IMAGE: NonEmptyEnvStringSchema.default(DEFAULT_BACKUP_PG_DUMP_DOCKER_IMAGE),
	// Where the backup looks up `pg_dump` and `docker` (the process's own search path).
	PATH: NonEmptyEnvStringSchema.default(DEFAULT_EXECUTABLE_SEARCH_PATH),
	// Load tests are off unless enabled; in production they also need the explicit override.
	LOAD_TESTING_ENABLED: BooleanFlagEnvSchema,
	LOAD_TESTING_ALLOW_PRODUCTION: BooleanFlagEnvSchema,
	// The address the load runner drives (default: API_PUBLIC_URL, else this API's own address).
	LOAD_TEST_TARGET_URL: HttpUrlEnvSchema.optional(),

	// Email
	EMAIL_MODE: EmailModeSchema.default("send"),
	EMAIL_PROVIDER: EmailProviderSchema.default("resend"),
	RESEND_API_KEY: NonEmptyEnvStringSchema.optional(),
	MAILPIT_URL: HttpUrlEnvSchema.default(DEFAULT_MAILPIT_URL),
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
	TRANSACTION_LOG_ENABLED: OptionalToggleEnvSchema,
	TRANSACTION_LOG_DIR: NonEmptyEnvStringSchema.default(DEFAULT_TRANSACTION_LOG_DIR),
	TRANSACTION_LOG_RETENTION_DAYS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_TRANSACTION_LOG_RETENTION_DAYS }),
	TRANSACTION_LOG_TIME_ZONE: NonEmptyEnvStringSchema.pipe(IanaTimeZoneSchema).optional(),
	OBSERVE_ENABLED: OptionalToggleEnvSchema,
	OBSERVE_APP_KEY: NonEmptyEnvStringSchema.optional(),
	OBSERVE_APP_SECRET: NonEmptyEnvStringSchema.optional(),
	OBSERVE_SERVICE_ID: NonEmptyEnvStringSchema.default(DEFAULT_OBSERVE_SERVICE_ID),

	// Tenancy
	TENANCY_ENABLED: BooleanFlagEnvSchema,
	/** Id of the real tenant a single-tenant deployment serves (required when TENANCY_ENABLED is off). */
	DEFAULT_TENANT_ID: z.uuid({ error: "must be the id (uuid) of an existing tenant" }).optional(),
});

/** The validated flat environment, before grouping. */
export type ApiEnv = z.output<typeof ApiEnvInputSchema>;
