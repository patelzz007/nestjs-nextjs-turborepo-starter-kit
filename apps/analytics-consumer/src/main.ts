import { EnvValidationError, KAFKA_TOPICS } from "@workspace/shared";
import { Kafka } from "kafkajs";
import pg from "pg";

import { loadConsumerEnv, type ConsumerEnv } from "./env";
import { InboxRetentionScheduler } from "./inbox-retention";
import { createConsoleJsonLogger } from "./logger";
import { ANALYTICS_CONSUMER_ID, handlePlatformMessage, type MessageHandlerDeps } from "./message-handler";
import { PgInboxStore } from "./pg-inbox-store";

const SUBSCRIBE_RETRY_DELAY_MS = 1_000;
const SUBSCRIBE_MAX_ATTEMPTS = 10;
const SERVICE_NAME = "analytics-consumer";
/** Exit code for "the worker cannot start with this configuration". */
const INVALID_CONFIGURATION_EXIT_CODE = 1;

function sleep(ms: number): Promise<void> {
	return new Promise((resolveSleep): void => {
		setTimeout(resolveSleep, ms);
	});
}

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
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const kafka = new Kafka({ clientId: SERVICE_NAME, brokers: env.KAFKA_BROKERS });
// The group id doubles as the inbox consumer id — each logical consumer dedupes on its own.
const consumer = kafka.consumer({ groupId: ANALYTICS_CONSUMER_ID });

const inboxStore = new PgInboxStore(pool);

const handlerDeps: MessageHandlerDeps = {
	store: inboxStore,
	logger,
	consumerId: ANALYTICS_CONSUMER_ID,
	nowMs: (): number => Date.now(),
};

// Hourly purge of inbox claims older than ANALYTICS_INBOX_RETENTION_DAYS (advisory-locked: one instance at a time).
const inboxRetention = new InboxRetentionScheduler({
	store: inboxStore,
	logger,
	nowMs: (): number => Date.now(),
	retentionDays: env.ANALYTICS_INBOX_RETENTION_DAYS,
});

let shutdownStarted = false;

/** Platform topics are created by the API producer on first publish — ensure they exist before subscribing. */
async function ensureKafkaTopics(): Promise<void> {
	const admin = kafka.admin();
	await admin.connect();
	try {
		const existingTopics: string[] = await admin.listTopics();
		const missingTopics = KAFKA_TOPICS.filter((topic: (typeof KAFKA_TOPICS)[number]): boolean => !existingTopics.includes(topic));
		if (missingTopics.length === 0) {
			return;
		}
		await admin.createTopics({
			topics: missingTopics.map((topic) => ({
				topic,
				numPartitions: 1,
				replicationFactor: 1,
			})),
			waitForLeaders: true,
		});
		logger.info({ event: "analytics.topics_created", topics: missingTopics.join(",") });
	} finally {
		await admin.disconnect();
	}
}

async function subscribeToPlatformTopics(): Promise<void> {
	let lastError: Error | undefined;
	for (let attempt = 1; attempt <= SUBSCRIBE_MAX_ATTEMPTS; attempt += 1) {
		try {
			await consumer.subscribe({ topics: [...KAFKA_TOPICS], fromBeginning: false });
			return;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			if (attempt < SUBSCRIBE_MAX_ATTEMPTS) {
				logger.warn({ event: "analytics.subscribe_retry", attempt, error: lastError.message });
				await sleep(SUBSCRIBE_RETRY_DELAY_MS * attempt);
			}
		}
	}
	throw lastError ?? new Error("Kafka subscribe failed");
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
	if (shutdownStarted) {
		return;
	}
	shutdownStarted = true;

	logger.info({ event: "analytics.shutdown_started", signal, timeoutMs: env.SHUTDOWN_TIMEOUT_MS });

	const forceExitTimer: NodeJS.Timeout = setTimeout((): void => {
		logger.error({ event: "analytics.shutdown_timed_out", timeoutMs: env.SHUTDOWN_TIMEOUT_MS });
		process.exit(1);
	}, env.SHUTDOWN_TIMEOUT_MS);

	try {
		await consumer.disconnect();
		await inboxRetention.stop();
		await pool.end();
		clearTimeout(forceExitTimer);
		logger.info({ event: "analytics.shutdown_completed" });
		process.exit(0);
	} catch (error) {
		clearTimeout(forceExitTimer);
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

	await ensureKafkaTopics();
	await consumer.connect();
	await subscribeToPlatformTopics();
	logger.info({ event: "analytics.subscribed", topics: KAFKA_TOPICS.join(","), groupId: ANALYTICS_CONSUMER_ID });

	await consumer.run({
		// At-least-once: the offset commits only after the handler resolves. The
		// handler dedupes redeliveries via the inbox and parks poison messages;
		// it only throws on transient failures, which kafkajs retries with backoff.
		eachMessage: async ({ topic, partition, message }): Promise<void> => {
			await handlePlatformMessage({ topic, partition, offset: message.offset, value: message.value }, handlerDeps);
		},
	});

	inboxRetention.start();
	logger.info({ event: "analytics.inbox_retention_scheduled", retentionDays: env.ANALYTICS_INBOX_RETENTION_DAYS });
}

async function run(): Promise<void> {
	try {
		await main();
	} catch (error) {
		logger.error({ event: "analytics.fatal", error: error instanceof Error ? error.message : String(error) });
		process.exit(1);
	}
}

void run();
