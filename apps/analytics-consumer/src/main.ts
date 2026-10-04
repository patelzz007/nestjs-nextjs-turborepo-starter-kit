import { setTimeout as delay } from "node:timers/promises";

import { EnvValidationError, KAFKA_TOPICS } from "@workspace/shared";

import { loadConsumerEnv, type ConsumerEnv } from "./env";
import { RetentionScheduler } from "./inbox-retention";
import { assertTopicsExist, buildConsumerConfig, createKafkaClient } from "./kafka";
import { createConsoleJsonLogger } from "./logger";
import { ANALYTICS_CONSUMER_ID, handlePlatformMessage, type AbortableSleep, type MessageHandlerDeps } from "./message-handler";
import { createConsumerPool, PgInboxStore } from "./pg-inbox-store";

const SERVICE_NAME = "analytics-consumer";
/** Exit code for "the worker cannot start with this configuration". */
const INVALID_CONFIGURATION_EXIT_CODE = 1;

/** Validate the environment before connecting to anything; print a value-free error and exit if invalid. */
function loadEnvOrExit(): ConsumerEnv {
	try {
		return loadConsumerEnv();
	} catch (error) {
		if (error instanceof EnvValidationError) {
			process.stderr.write(`${error.message}\n`);
			process.exit(INVALID_CONFIGURATION_EXIT_CODE);
		}
		throw error;
	}
}

const env: ConsumerEnv = loadEnvOrExit();

const logger = createConsoleJsonLogger(SERVICE_NAME);
const pool = createConsumerPool(env.databaseUrl, env.dbPool);
// An idle pooled connection can fail (server restart, network); log it instead of crashing the process.
pool.on("error", (error: Error): void => {
	logger.error({ event: "analytics.db_pool_error", error: error.message });
});

const kafkaClient = createKafkaClient(env.kafka, logger);
const kafka = kafkaClient.kafka;
// The group id doubles as the inbox consumer id — each logical consumer dedupes on its own.
const consumer = kafka.consumer(buildConsumerConfig(ANALYTICS_CONSUMER_ID, env.startFrom));
const inboxStore = new PgInboxStore(pool);
const shutdownSignal = new AbortController();

const sleep: AbortableSleep = (delayMs: number, signal: AbortSignal): Promise<void> => delay(delayMs, undefined, { signal });

const handlerDeps: MessageHandlerDeps = {
	store: inboxStore,
	logger,
	consumerId: ANALYTICS_CONSUMER_ID,
	nowMs: (): number => Date.now(),
	retry: env.retry,
	deadLetterMaxPayloadBytes: env.deadLetterMaxPayloadBytes,
	sleep,
	random: Math.random,
	signal: shutdownSignal.signal,
};

// Hourly purge of inbox claims and parked messages past their windows (advisory-locked: one instance at a time).
const retention = new RetentionScheduler({
	store: inboxStore,
	logger,
	nowMs: (): number => Date.now(),
	consumerId: ANALYTICS_CONSUMER_ID,
	inboxRetentionDays: env.inboxRetentionDays,
	deadLetterRetentionDays: env.deadLetterRetentionDays,
});

let shutdownStarted = false;

/** Topics are provisioned explicitly — refuse to start (with the provisioning hint) if one is missing. */
async function verifyTopics(): Promise<void> {
	const admin = kafka.admin();
	await admin.connect();
	try {
		await assertTopicsExist(admin, KAFKA_TOPICS, env.kafka.adminTimeoutMs);
	} finally {
		await admin.disconnect();
	}
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
	if (shutdownStarted) {
		return;
	}
	shutdownStarted = true;

	logger.info({ event: "analytics.shutdown_started", signal, timeoutMs: env.shutdownTimeoutMs });

	const forceExitTimer: NodeJS.Timeout = setTimeout((): void => {
		logger.error({ event: "analytics.shutdown_timed_out", timeoutMs: env.shutdownTimeoutMs });
		process.exit(1);
	}, env.shutdownTimeoutMs);

	// A record waiting between retries is released un-committed (redelivered after restart).
	shutdownSignal.abort();
	try {
		await consumer.disconnect();
		await retention.stop();
		await pool.end();
		clearTimeout(forceExitTimer);
		kafkaClient.flushLogs();
		logger.info({ event: "analytics.shutdown_completed" });
		process.exit(0);
	} catch (error) {
		clearTimeout(forceExitTimer);
		kafkaClient.flushLogs();
		logger.error({ event: "analytics.shutdown_failed", error: error instanceof Error ? error.message : String(error) });
		process.exit(1);
	}
}

function registerGracefulShutdown(): void {
	process.once("SIGINT", (): void => {
		void shutdown("SIGINT");
	});
	process.once("SIGTERM", (): void => {
		void shutdown("SIGTERM");
	});
}

async function main(): Promise<void> {
	registerGracefulShutdown();

	await verifyTopics();
	await consumer.connect();
	await consumer.subscribe({ topics: [...KAFKA_TOPICS] });
	logger.info({ event: "analytics.subscribed", topics: KAFKA_TOPICS.join(","), groupId: ANALYTICS_CONSUMER_ID, startFrom: env.startFrom });

	await consumer.run({
		// At-least-once: the offset is stored only after the handler resolves —
		// applied, deduplicated, or durably parked. The handler retries
		// transient failures itself (bounded), so it only rejects when parking
		// is impossible or shutdown interrupts it; the record is then redelivered.
		eachMessage: async ({ topic, partition, message }): Promise<void> => {
			await handlePlatformMessage({ topic, partition, offset: message.offset, value: message.value }, handlerDeps);
		},
	});

	retention.start();
	logger.info({ event: "analytics.retention_scheduled", inboxRetentionDays: env.inboxRetentionDays, deadLetterRetentionDays: env.deadLetterRetentionDays });
}

async function run(): Promise<void> {
	try {
		await main();
	} catch (error) {
		kafkaClient.flushLogs();
		logger.error({ event: "analytics.fatal", error: error instanceof Error ? error.message : String(error) });
		process.exit(1);
	}
}

void run();
