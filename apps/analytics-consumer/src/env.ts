// ============================================
// env.ts - The ONLY place the analytics consumer reads process.env
// ============================================
// Validated once at boot through zod (building blocks shared with the API in
// @workspace/shared runtime/app-env.ts and @workspace/messaging/kafka). An
// invalid or missing variable stops the process with a message that names
// every bad variable and never prints a value. ESLint
// (`no-restricted-properties`) rejects process.env elsewhere.
//
// The consumer owns its configuration: it reads ONLY the variables declared
// below, from its own environment (apps/analytics-consumer/.env in local
// development via `dotenv run`, the deployment's env in production). It
// never loads the API's .env, and never sees the API's secrets.

import type { DbPoolSettings, ProcessingRetrySettings } from "@workspace/messaging/inbox";
import { KafkaSecurityEnvShape, listKafkaSecurityEnvIssues, toKafkaSecurityOptions, type KafkaSecurityOptions } from "@workspace/messaging/kafka";
import { integerEnvSchema, KafkaBrokersEnvSchema, optionalIntegerEnvSchema, parseEnvOrThrow, PostgresUrlEnvSchema, type EnvSource } from "@workspace/shared";
import { z } from "zod";

/** Scope named in the fail-fast error message. */
export const CONSUMER_ENV_SCOPE = "apps/analytics-consumer";

const MS_PER_SECOND = 1_000;

export const DEFAULT_SHUTDOWN_TIMEOUT_MS: number = 15 * MS_PER_SECOND;

/** Upper bound for any "days" setting (10 years) — a typo such as an extra zero fails boot. */
export const MAX_RETENTION_DAYS = 3_650;

/**
 * Kafka's default topic retention (`log.retention.hours` = 168 → 7 days).
 * Used as the default for `KAFKA_TOPIC_RETENTION_DAYS`, the retention the
 * provisioning step sets on every platform topic.
 */
export const DEFAULT_KAFKA_TOPIC_RETENTION_DAYS = 7;

/**
 * Default inbox window = twice the topic retention. The extra window covers
 * the other ways an event id can come back — an outbox row re-queued from
 * FAILED by an operator (docs/technical/messaging.md) or a lagging group.
 */
export const INBOX_RETENTION_TOPIC_MULTIPLIER = 2;

/** Default days a parked (dead-lettered) message is kept for operators before the retention job deletes it. */
export const DEFAULT_DEAD_LETTER_RETENTION_DAYS = 30;

/**
 * Default cap on the stored copy of a parked message: Kafka's default
 * `message.max.bytes` (1 MiB), so any record a default broker accepts is kept
 * whole. A larger record is stored truncated — with its original size, its
 * SHA-256 and a `raw_value_truncated` flag, never silently.
 */
export const DEFAULT_DEAD_LETTER_MAX_PAYLOAD_BYTES = 1_048_576;
export const MIN_DEAD_LETTER_MAX_PAYLOAD_BYTES = 1_024;
/** 16 MiB — far above any sane Kafka record. */
export const MAX_DEAD_LETTER_MAX_PAYLOAD_BYTES = 16_777_216;

/** Processing attempts for one record before it is parked as RETRIES_EXHAUSTED (first try included). */
export const DEFAULT_MAX_PROCESSING_ATTEMPTS = 5;
export const MAX_PROCESSING_ATTEMPTS = 20;
export const DEFAULT_RETRY_BASE_DELAY_MS = 500;
export const DEFAULT_RETRY_MAX_DELAY_MS: number = 10 * MS_PER_SECOND;

/** Postgres pool: small (one partition is processed at a time) with bounded waits. */
export const DEFAULT_DB_POOL_MAX = 5;
export const MAX_DB_POOL_MAX = 100;
export const DEFAULT_DB_CONNECTION_TIMEOUT_MS: number = 10 * MS_PER_SECOND;
export const DEFAULT_DB_IDLE_TIMEOUT_MS: number = 30 * MS_PER_SECOND;
export const DEFAULT_DB_STATEMENT_TIMEOUT_MS: number = 30 * MS_PER_SECOND;

/** Where a NEW consumer group (no committed offset) starts reading. */
export const ConsumerStartPositionSchema = z.enum(["earliest", "latest"]);
export type { DbPoolSettings, ProcessingRetrySettings };
export type ConsumerStartPosition = z.output<typeof ConsumerStartPositionSchema>;

/** Default: a new group consumes the whole retained backlog — nothing already published is skipped. */
export const DEFAULT_CONSUMER_START_POSITION: ConsumerStartPosition = "earliest";

/** Budget for admin requests (topic checks, provisioning). */
export const DEFAULT_KAFKA_ADMIN_TIMEOUT_MS: number = 30 * MS_PER_SECOND;

const DEFAULT_CLIENT_ID = "analytics-consumer";

const NonEmptyEnvStringSchema = z.string().trim().min(1, "must not be empty");

/** Kafka connection (brokers, client id, TLS / SASL) — shared by the worker and the topic provisioning step. */
const KafkaConnectionEnvShape = {
	KAFKA_BROKERS: KafkaBrokersEnvSchema,
	KAFKA_CLIENT_ID: NonEmptyEnvStringSchema.default(DEFAULT_CLIENT_ID),
	KAFKA_ADMIN_TIMEOUT_MS: integerEnvSchema({ min: MS_PER_SECOND, defaultValue: DEFAULT_KAFKA_ADMIN_TIMEOUT_MS }),
	...KafkaSecurityEnvShape,
	/** Retention (days) every platform topic is provisioned with — the Kafka redelivery horizon. */
	KAFKA_TOPIC_RETENTION_DAYS: integerEnvSchema({ min: 1, max: MAX_RETENTION_DAYS, defaultValue: DEFAULT_KAFKA_TOPIC_RETENTION_DAYS }),
};

/**
 * Worker configuration. Not strict: `process.env` also carries the OS
 * environment (PATH, HOME, …) — undeclared keys are ignored, never read.
 */
export const ConsumerEnvInputSchema = z.object({
	/** Login of the least-privilege `analytics_consumer` Postgres role (prisma/rls/90-analytics-consumer.sql). */
	ANALYTICS_CONSUMER_DATABASE_URL: PostgresUrlEnvSchema,
	ANALYTICS_DB_POOL_MAX: integerEnvSchema({ min: 1, max: MAX_DB_POOL_MAX, defaultValue: DEFAULT_DB_POOL_MAX }),
	ANALYTICS_DB_CONNECTION_TIMEOUT_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_DB_CONNECTION_TIMEOUT_MS }),
	ANALYTICS_DB_IDLE_TIMEOUT_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_DB_IDLE_TIMEOUT_MS }),
	ANALYTICS_DB_STATEMENT_TIMEOUT_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_DB_STATEMENT_TIMEOUT_MS }),
	...KafkaConnectionEnvShape,
	ANALYTICS_CONSUMER_START_FROM: ConsumerStartPositionSchema.default(DEFAULT_CONSUMER_START_POSITION),
	ANALYTICS_MAX_PROCESSING_ATTEMPTS: integerEnvSchema({ min: 1, max: MAX_PROCESSING_ATTEMPTS, defaultValue: DEFAULT_MAX_PROCESSING_ATTEMPTS }),
	ANALYTICS_RETRY_BASE_DELAY_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_RETRY_BASE_DELAY_MS }),
	ANALYTICS_RETRY_MAX_DELAY_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_RETRY_MAX_DELAY_MS }),
	SHUTDOWN_TIMEOUT_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_SHUTDOWN_TIMEOUT_MS }),
	/** Days an `inbox_processed_events` claim is kept. Unset = `KAFKA_TOPIC_RETENTION_DAYS` × 2. */
	ANALYTICS_INBOX_RETENTION_DAYS: optionalIntegerEnvSchema({ min: 1, max: MAX_RETENTION_DAYS }),
	/** Days a parked message (`inbox_dead_letters`) is kept for operators. */
	ANALYTICS_DEAD_LETTER_RETENTION_DAYS: integerEnvSchema({ min: 1, max: MAX_RETENTION_DAYS, defaultValue: DEFAULT_DEAD_LETTER_RETENTION_DAYS }),
	ANALYTICS_DEAD_LETTER_MAX_PAYLOAD_BYTES: integerEnvSchema({
		min: MIN_DEAD_LETTER_MAX_PAYLOAD_BYTES,
		max: MAX_DEAD_LETTER_MAX_PAYLOAD_BYTES,
		defaultValue: DEFAULT_DEAD_LETTER_MAX_PAYLOAD_BYTES,
	}),
});

type ConsumerEnvInput = z.output<typeof ConsumerEnvInputSchema>;

/** Validated worker configuration (derived defaults resolved, security mapped). */
export interface ConsumerEnv {
	readonly databaseUrl: string;
	readonly dbPool: DbPoolSettings;
	readonly kafka: KafkaConnectionSettings;
	readonly startFrom: ConsumerStartPosition;
	readonly retry: ProcessingRetrySettings;
	readonly shutdownTimeoutMs: number;
	readonly inboxRetentionDays: number;
	readonly deadLetterRetentionDays: number;
	readonly deadLetterMaxPayloadBytes: number;
}

export interface KafkaConnectionSettings {
	readonly brokers: readonly string[];
	readonly clientId: string;
	readonly security: KafkaSecurityOptions;
	readonly adminTimeoutMs: number;
	readonly topicRetentionDays: number;
}

/** Inbox window when `ANALYTICS_INBOX_RETENTION_DAYS` is unset. */
export function defaultInboxRetentionDays(topicRetentionDays: number): number {
	return Math.min(topicRetentionDays * INBOX_RETENTION_TOPIC_MULTIPLIER, MAX_RETENTION_DAYS);
}

function addSecurityIssues(env: z.output<z.ZodObject<typeof KafkaSecurityEnvShape>>, context: z.RefinementCtx): void {
	for (const issue of listKafkaSecurityEnvIssues(env)) {
		context.addIssue({ code: "custom", path: [issue.variable], message: issue.message });
	}
}

/**
 * Cross-field rules:
 * - the inbox window must be STRICTLY longer than the topic retention — a
 *   record still in the log can be redelivered (rebalance, crash before the
 *   commit, offset reset), and a purged claim could no longer dedupe it;
 * - the retry delay cap must not be below its base.
 */
function checkConsumerEnv(env: ConsumerEnvInput, context: z.RefinementCtx): void {
	addSecurityIssues(env, context);
	if (env.ANALYTICS_INBOX_RETENTION_DAYS !== undefined && env.ANALYTICS_INBOX_RETENTION_DAYS <= env.KAFKA_TOPIC_RETENTION_DAYS) {
		context.addIssue({
			code: "custom",
			path: ["ANALYTICS_INBOX_RETENTION_DAYS"],
			message: "must be greater than KAFKA_TOPIC_RETENTION_DAYS (a record still in the topic can be redelivered, and its purged claim could no longer dedupe it)",
		});
	}
	if (env.ANALYTICS_RETRY_MAX_DELAY_MS < env.ANALYTICS_RETRY_BASE_DELAY_MS) {
		context.addIssue({ code: "custom", path: ["ANALYTICS_RETRY_MAX_DELAY_MS"], message: "must be at least ANALYTICS_RETRY_BASE_DELAY_MS" });
	}
}

function toKafkaConnectionSettings(env: z.output<z.ZodObject<typeof KafkaConnectionEnvShape>>): KafkaConnectionSettings {
	return {
		brokers: env.KAFKA_BROKERS,
		clientId: env.KAFKA_CLIENT_ID,
		security: toKafkaSecurityOptions(env),
		adminTimeoutMs: env.KAFKA_ADMIN_TIMEOUT_MS,
		topicRetentionDays: env.KAFKA_TOPIC_RETENTION_DAYS,
	};
}

function toConsumerEnv(env: ConsumerEnvInput): ConsumerEnv {
	return {
		databaseUrl: env.ANALYTICS_CONSUMER_DATABASE_URL,
		dbPool: {
			max: env.ANALYTICS_DB_POOL_MAX,
			connectionTimeoutMs: env.ANALYTICS_DB_CONNECTION_TIMEOUT_MS,
			idleTimeoutMs: env.ANALYTICS_DB_IDLE_TIMEOUT_MS,
			statementTimeoutMs: env.ANALYTICS_DB_STATEMENT_TIMEOUT_MS,
		},
		kafka: toKafkaConnectionSettings(env),
		startFrom: env.ANALYTICS_CONSUMER_START_FROM,
		retry: { maxAttempts: env.ANALYTICS_MAX_PROCESSING_ATTEMPTS, baseDelayMs: env.ANALYTICS_RETRY_BASE_DELAY_MS, maxDelayMs: env.ANALYTICS_RETRY_MAX_DELAY_MS },
		shutdownTimeoutMs: env.SHUTDOWN_TIMEOUT_MS,
		inboxRetentionDays: env.ANALYTICS_INBOX_RETENTION_DAYS ?? defaultInboxRetentionDays(env.KAFKA_TOPIC_RETENTION_DAYS),
		deadLetterRetentionDays: env.ANALYTICS_DEAD_LETTER_RETENTION_DAYS,
		deadLetterMaxPayloadBytes: env.ANALYTICS_DEAD_LETTER_MAX_PAYLOAD_BYTES,
	};
}

export const ConsumerEnvSchema = ConsumerEnvInputSchema.superRefine(checkConsumerEnv).transform(toConsumerEnv);

/** Parse an env source, or throw an `EnvValidationError` listing every bad variable (value-free). */
export function parseConsumerEnv(source: EnvSource): ConsumerEnv {
	return parseEnvOrThrow(ConsumerEnvSchema, source, CONSUMER_ENV_SCOPE);
}

/** Reads and validates the worker's own environment. */
export function loadConsumerEnv(): ConsumerEnv {
	return parseConsumerEnv(process.env);
}

// ── Topic provisioning (`pnpm kafka:provision-topics`) ─────────────────────

/** Scope named when the provisioning env is invalid. */
export const TOPIC_PROVISIONING_ENV_SCOPE = "apps/analytics-consumer (kafka:provision-topics)";

/** Highest partition count / replication factor accepted (a typo guard, not a Kafka limit). */
export const MAX_TOPIC_PARTITIONS = 1_000;
export const MAX_TOPIC_REPLICATION_FACTOR = 7;

/** A whole number in `[min, max]` that MUST be set (no default). */
function requiredIntegerEnvSchema(min: number, max: number): z.ZodType<number, string> {
	return z
		.string()
		.trim()
		.regex(/^\d+$/, "must be a whole number")
		.transform((value: string): number => Number(value))
		.pipe(
			z
				.number()
				.int()
				.min(min, `must be at least ${String(min)}`)
				.max(max, `must be at most ${String(max)}`),
		);
}

/**
 * Partitions and replication factor have NO default on purpose: the broker's
 * defaults (often 1 / 1) are exactly what silently auto-created topics got.
 */
export const TopicProvisioningEnvSchema = z
	.object({
		...KafkaConnectionEnvShape,
		KAFKA_TOPIC_PARTITIONS: requiredIntegerEnvSchema(1, MAX_TOPIC_PARTITIONS),
		KAFKA_TOPIC_REPLICATION_FACTOR: requiredIntegerEnvSchema(1, MAX_TOPIC_REPLICATION_FACTOR),
	})
	.superRefine(addSecurityIssues)
	.transform((env): TopicProvisioningEnv => ({
		kafka: toKafkaConnectionSettings(env),
		partitions: env.KAFKA_TOPIC_PARTITIONS,
		replicationFactor: env.KAFKA_TOPIC_REPLICATION_FACTOR,
	}));

export interface TopicProvisioningEnv {
	readonly kafka: KafkaConnectionSettings;
	readonly partitions: number;
	readonly replicationFactor: number;
}

export function parseTopicProvisioningEnv(source: EnvSource): TopicProvisioningEnv {
	return parseEnvOrThrow(TopicProvisioningEnvSchema, source, TOPIC_PROVISIONING_ENV_SCOPE);
}

export function loadTopicProvisioningEnv(): TopicProvisioningEnv {
	return parseTopicProvisioningEnv(process.env);
}

// ── Kafka connection only (Kafka e2e suite) ────────────────────────────────

export const KAFKA_CONNECTION_ENV_SCOPE = "apps/analytics-consumer (kafka connection)";

export const KafkaConnectionEnvSchema = z.object(KafkaConnectionEnvShape).superRefine(addSecurityIssues).transform(toKafkaConnectionSettings);

/** Brokers, client id and security alone — what a Kafka-only tool needs. */
export function loadKafkaConnectionEnv(): KafkaConnectionSettings {
	return parseEnvOrThrow(KafkaConnectionEnvSchema, process.env, KAFKA_CONNECTION_ENV_SCOPE);
}

// ── Database login provisioning (`pnpm db:provision-login`) ───────────────

export const DB_LOGIN_PROVISIONING_ENV_SCOPE = "apps/analytics-consumer (db:provision-login)";

/**
 * The admin connection (a role allowed to CREATE ROLE — the migrating user
 * locally) creates/updates the login named in ANALYTICS_CONSUMER_DATABASE_URL
 * with that URL's password, as a member of the `analytics_consumer` role.
 */
export const DbLoginProvisioningEnvSchema = z
	.object({
		ANALYTICS_CONSUMER_DB_ADMIN_URL: PostgresUrlEnvSchema,
		ANALYTICS_CONSUMER_DATABASE_URL: PostgresUrlEnvSchema,
	})
	.transform((env): DbLoginProvisioningEnv => ({ adminUrl: env.ANALYTICS_CONSUMER_DB_ADMIN_URL, consumerUrl: env.ANALYTICS_CONSUMER_DATABASE_URL }));

export interface DbLoginProvisioningEnv {
	readonly adminUrl: string;
	readonly consumerUrl: string;
}

export function parseDbLoginProvisioningEnv(source: EnvSource): DbLoginProvisioningEnv {
	return parseEnvOrThrow(DbLoginProvisioningEnvSchema, source, DB_LOGIN_PROVISIONING_ENV_SCOPE);
}

/** Admin + consumer URLs — used by `db:provision-login` and by the e2e suites (fixtures need the admin role). */
export function loadDbLoginProvisioningEnv(): DbLoginProvisioningEnv {
	return parseDbLoginProvisioningEnv(process.env);
}
