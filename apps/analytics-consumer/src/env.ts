// ============================================
// env.ts - The ONLY place the analytics consumer reads process.env
// ============================================
// Validated once at boot through zod (building blocks shared with the API in
// @workspace/shared runtime/app-env.ts). An invalid or missing variable stops
// the worker with a message that names every bad variable and never prints a
// value. ESLint (`no-restricted-properties`) rejects process.env elsewhere.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { integerEnvSchema, KafkaBrokersEnvSchema, parseEnvOrThrow, PostgresUrlEnvSchema, type EnvSource } from "@workspace/shared";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

/** Scope named in the fail-fast error message. */
export const CONSUMER_ENV_SCOPE = "apps/analytics-consumer";

export const DEFAULT_SHUTDOWN_TIMEOUT_MS = 15_000;

/**
 * Kafka's default topic retention (`log.retention.hours` = 168 → 7 days; the
 * local compose broker uses the default). A record older than this is gone
 * from the log and can no longer be redelivered by a rebalance, a crash
 * before the offset commit, or an operator's offset reset.
 */
export const KAFKA_DEFAULT_TOPIC_RETENTION_DAYS = 7;

/**
 * Floor for `ANALYTICS_INBOX_RETENTION_DAYS`: strictly longer than Kafka's
 * default redelivery horizon, so an inbox claim can never be purged while its
 * record is still replayable. Raise the setting if topics retain longer.
 */
export const MIN_INBOX_RETENTION_DAYS: number = KAFKA_DEFAULT_TOPIC_RETENTION_DAYS + 1;

/** Upper bound (10 years) — a typo such as an extra zero should fail boot, not disable retention. */
export const MAX_INBOX_RETENTION_DAYS = 3_650;

/**
 * Default inbox retention: twice Kafka's default topic retention. The extra
 * week covers the other ways an event id can come back — an outbox row
 * re-queued from FAILED by an operator (docs/infrastructure/messaging.md), a
 * lagging consumer group, or a topic whose retention was raised later.
 */
export const DEFAULT_INBOX_RETENTION_DAYS: number = KAFKA_DEFAULT_TOPIC_RETENTION_DAYS * 2;

/**
 * Consumer configuration. Not strict: `process.env` carries the whole OS
 * environment plus every API variable from the shared apps/api/.env.
 */
export const ConsumerEnvSchema = z.object({
	DATABASE_URL: PostgresUrlEnvSchema,
	KAFKA_BROKERS: KafkaBrokersEnvSchema,
	SHUTDOWN_TIMEOUT_MS: integerEnvSchema({ min: 1, defaultValue: DEFAULT_SHUTDOWN_TIMEOUT_MS }),
	/** Days an `inbox_processed_events` claim is kept before the hourly retention job deletes it. */
	ANALYTICS_INBOX_RETENTION_DAYS: integerEnvSchema({ min: MIN_INBOX_RETENTION_DAYS, max: MAX_INBOX_RETENTION_DAYS, defaultValue: DEFAULT_INBOX_RETENTION_DAYS }),
});

export type ConsumerEnv = z.output<typeof ConsumerEnvSchema>;

/** Parse an env source, or throw an `EnvValidationError` listing every bad variable (value-free). */
export function parseConsumerEnv(source: EnvSource): ConsumerEnv {
	return parseEnvOrThrow(ConsumerEnvSchema, source, CONSUMER_ENV_SCOPE);
}

/** Load the shared API env so DATABASE_URL / KAFKA_BROKERS match the Nest app. */
export function loadSharedEnvFile(): void {
	const packageRoot: string = dirname(fileURLToPath(import.meta.url));
	const envPath: string = resolve(packageRoot, "../../api/.env");
	const result = loadEnv({ path: envPath, quiet: true });
	if (result.error !== undefined) {
		throw new Error(`Failed to load ${envPath}: ${result.error.message}`);
	}
	if (result.parsed === undefined || Object.keys(result.parsed).length === 0) {
		throw new Error(`No variables loaded from ${envPath} — copy apps/api/.env.example to apps/api/.env`);
	}
}

/** Loads apps/api/.env into the process environment and parses it once. */
export function loadConsumerEnv(): ConsumerEnv {
	loadSharedEnvFile();
	return parseConsumerEnv(process.env);
}
