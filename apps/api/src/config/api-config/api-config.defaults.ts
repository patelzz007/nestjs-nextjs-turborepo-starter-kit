// config/api-config/api-config.defaults.ts — Durations and defaults (named, never magic) the environment schema and its grouping share.
// Part of the API environment contract; `../api-config.schema.ts` is its public entry.

import type { AppVersion, NodeEnv } from "@workspace/shared";

import type { LogLevel, TenantKmsProvider } from "../api-env.fields";

// ── Durations and defaults (named, never magic) ────────────────────────────

export const MS_PER_SECOND = 1_000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

export const MAX_TCP_PORT = 65_535;
export const DEFAULT_PORT = 8080;
export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 15 * MS_PER_SECOND;

export const DEFAULT_DB_POOL_MAX = 10;
export const DEFAULT_DB_IDLE_TIMEOUT_MS = 30 * MS_PER_SECOND;

export const DEFAULT_JWT_ACCESS_EXPIRY = "15m";
export const DEFAULT_JWT_REFRESH_EXPIRY = "7d";
/** OWASP floor for bcrypt work factor; above 15 hashing becomes a DoS vector. */
export const MIN_BCRYPT_SALT_ROUNDS = 10;
export const MAX_BCRYPT_SALT_ROUNDS = 15;
export const DEFAULT_BCRYPT_SALT_ROUNDS = 12;

export const DEFAULT_MFA_ENROLLMENT_DEADLINE_MS = 30 * MS_PER_DAY;
export const DEFAULT_MFA_RECOVERY_DELAY_MS = MS_PER_DAY;
export const DEFAULT_MFA_STEP_UP_TTL_MS = 5 * MS_PER_MINUTE;

/** The first mobile release: until the minimum is raised, every released build is served (ADR 033). */
export const DEFAULT_MOBILE_MIN_SUPPORTED_VERSION: AppVersion = "1.0.0";

/** A location lookup slower than this is abandoned (the session is stored without a location); it never delays sign-in by more. */
export const DEFAULT_SESSION_LOCATION_TIMEOUT_MS = 300;
export const MAX_SESSION_LOCATION_TIMEOUT_MS = 5_000;
/** A GitHub read slower than this fails (the last good answer is served if there is one); GitHub normally answers in well under a second. */
export const DEFAULT_GITHUB_REQUEST_TIMEOUT_MS = 5 * MS_PER_SECOND;
export const MAX_GITHUB_REQUEST_TIMEOUT_MS = 30 * MS_PER_SECOND;
/** A webhook secret no one can guess: 32 characters at least (`openssl rand -hex 32` gives 64). */
export const GITHUB_WEBHOOK_SECRET_MIN_LENGTH = 32;
/** How long a GitHub answer is served from memory before it is read again — keeps every instance far below GitHub's 5,000 requests/hour. */
export const DEFAULT_GITHUB_CACHE_TTL_MS = 5 * MS_PER_MINUTE;
export const MAX_GITHUB_CACHE_TTL_MS = MS_PER_DAY;
/** Version of `TENANT_ENCRYPTION_MASTER_KEY` when `TENANT_ENCRYPTION_MASTER_KEY_VERSION` is unset (the first KEK). */
export const DEFAULT_TENANT_MASTER_KEY_VERSION = 1;
/** KMS provider outside production when `TENANT_KMS_PROVIDER` is unset. Production must set it explicitly. */
export const NON_PRODUCTION_TENANT_KMS_PROVIDER: TenantKmsProvider = "local";

export const MAX_EMAIL_ATTEMPTS = 10;
export const DEFAULT_EMAIL_ATTEMPTS = 3;
export const MIN_EMAIL_TIMEOUT_MS = 100;
export const DEFAULT_EMAIL_TIMEOUT_MS = 10 * MS_PER_SECOND;
/** Where the `mailpit` Docker service listens by default (`pnpm mailpit`): web inbox + HTTP API. */
export const DEFAULT_MAILPIT_URL = "http://localhost:8025";
export const DEFAULT_WEBHOOK_RATE_LIMIT_PER_MINUTE = 120;

export const DEFAULT_THROTTLE_DEFAULT_LIMIT = 300;
export const DEFAULT_THROTTLE_STRICT_LIMIT = 30;
export const MIN_THROTTLE_TTL_MS = MS_PER_SECOND;
export const DEFAULT_THROTTLE_TTL_MS = MS_PER_MINUTE;

export const DEFAULT_AUTHORIZATION_CACHE_TTL_MS = 5 * MS_PER_MINUTE;
export const DEFAULT_USER_SESSION_CACHE_TTL_MS = 30 * MS_PER_MINUTE;
export const DEFAULT_ACCESS_TOKEN_STATE_CACHE_TTL_MS = 30 * MS_PER_SECOND;
export const DEFAULT_CACHE_MAX_ENTRIES = 10_000;
export const DEFAULT_ACCESS_TOKEN_STATE_CACHE_MAX_ENTRIES = 50_000;
export const DEFAULT_SECURITY_COUNTER_MAX_KEYS = 50_000;

export const DEFAULT_STORAGE_DOWNLOAD_TTL_SECONDS = 300;
export const PRODUCTION_STORAGE_PHYSICAL_DELETE_DELAY_MS = 30 * MS_PER_DAY;
export const NON_PRODUCTION_STORAGE_PHYSICAL_DELETE_DELAY_MS = MS_PER_HOUR;
export const DEFAULT_AWS_REGION = "ap-southeast-1";
/** Local-provider container names (directories under apps/api/.object-storage). */
export const LOCAL_PRIVATE_CONTAINER = "local-private-bucket";
export const LOCAL_PUBLIC_CONTAINER = "local-public-bucket";
/** Buckets named `local-*` are local-provider containers, never S3 buckets. */
export const LOCAL_CONTAINER_PREFIX = "local-";

/**
 * LOG_LEVEL when it is not set: development shows Nest's `log` level (route mapping, module
 * start-up) so `pnpm dev` lists the API's endpoints; every other environment stays quiet.
 */
export const DEFAULT_LOG_LEVEL_BY_NODE_ENV: Readonly<Record<NodeEnv, LogLevel>> = {
	development: "info",
	test: "warn",
	production: "warn",
};
/**
 * Memory leak detection (`MemoryMonitorService`): heap growth inside the
 * first minutes is module loading, JIT and cache warm-up — never judged.
 */
export const DEFAULT_MEMORY_LEAK_WARMUP_MS = 5 * MS_PER_MINUTE;
/** Window over which the post-GC heap floor must keep rising before a leak is reported. */
export const DEFAULT_MEMORY_LEAK_WINDOW_MS = 30 * MS_PER_MINUTE;
/** A window shorter than this sees too few major GCs to tell a trend from noise. */
export const MIN_MEMORY_LEAK_WINDOW_MS = 5 * MS_PER_MINUTE;
/** Rise of the post-GC heap floor from the earlier to the later half of the window that counts as a suspected leak. */
export const DEFAULT_MEMORY_LEAK_GROWTH_THRESHOLD_MB = 64;
/** Where the plain-text transaction log is written when TRANSACTION_LOG_DIR is unset (relative to the monorepo root: `<repo>/logs/transactions`). */
export const DEFAULT_TRANSACTION_LOG_DIR = "logs/transactions";
/** Days of transaction log files kept when TRANSACTION_LOG_RETENTION_DAYS is unset. */
export const DEFAULT_TRANSACTION_LOG_RETENTION_DAYS = 30;

/**
 * The zone the transaction log reads its times in when TRANSACTION_LOG_TIME_ZONE
 * is unset: the server's own (`TZ`, else the operating system's setting), so a
 * developer in Kuala Lumpur reads Kuala Lumpur time. A container without `TZ` is UTC.
 */
export function hostTimeZone(): string {
	return new Intl.DateTimeFormat().resolvedOptions().timeZone;
}
/** Service id reported to Observe when OBSERVE_SERVICE_ID is unset. */
export const DEFAULT_OBSERVE_SERVICE_ID = "api";
/** Kafka client id and Redis connection name when MESSAGING_CLIENT_ID / MESSAGING_CONNECTION_NAME are unset. */
export const DEFAULT_MESSAGING_CLIENT_ID = "api";
/** BullMQ key prefix — also Bull Board's `BULL_PREFIX` in compose.yml. */
export const DEFAULT_BULLMQ_PREFIX = "bull";
/** Kafka publish budget (retries included) before the outbox dispatcher sees a failure and backs off. */
export const DEFAULT_KAFKA_DELIVERY_TIMEOUT_MS = 30 * MS_PER_SECOND;
/** librdkafka's floor for `message.timeout.ms` (1 s). */
export const MIN_KAFKA_DELIVERY_TIMEOUT_MS = MS_PER_SECOND;
