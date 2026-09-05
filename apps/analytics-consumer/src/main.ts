import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { KAFKA_TOPICS, PlatformEventEnvelopeSchema } from "@workspace/shared";
import { config as loadEnv } from "dotenv";
import { Kafka } from "kafkajs";
import pg from "pg";

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 15_000;
const SUBSCRIBE_RETRY_DELAY_MS = 1_000;
const SUBSCRIBE_MAX_ATTEMPTS = 10;

/** Load shared API env so DATABASE_URL / KAFKA_BROKERS match the Nest app. */
function loadSharedEnv(): void {
	const packageRoot: string = dirname(fileURLToPath(import.meta.url));
	const envPath: string = resolve(packageRoot, "../../api/.env");
	const result = loadEnv({ path: envPath });
	if (result.error !== undefined) {
		throw new Error(`Failed to load ${envPath}: ${result.error.message}`);
	}
	if (result.parsed === undefined || Object.keys(result.parsed).length === 0) {
		throw new Error(`No variables loaded from ${envPath} — copy apps/api/.env.example to apps/api/.env`);
	}
}

function readRequiredEnv(name: string): string {
	const value: string | undefined = process.env[name];
	if (value === undefined || value.trim().length === 0) {
		throw new Error(`${name} is required (set it in apps/api/.env)`);
	}
	return value;
}

function readShutdownTimeoutMs(): number {
	const raw: string | undefined = process.env.SHUTDOWN_TIMEOUT_MS;
	if (raw === undefined || raw.trim() === "") {
		return DEFAULT_SHUTDOWN_TIMEOUT_MS;
	}
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) {
		return DEFAULT_SHUTDOWN_TIMEOUT_MS;
	}
	return parsed;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolveSleep): void => {
		setTimeout(resolveSleep, ms);
	});
}

loadSharedEnv();

const databaseUrl: string = readRequiredEnv("DATABASE_URL");
const kafkaBrokersRaw: string = readRequiredEnv("KAFKA_BROKERS");

const brokers: string[] = kafkaBrokersRaw
	.split(",")
	.map((broker: string): string => broker.trim())
	.filter((broker: string): boolean => broker.length > 0);

const pool = new pg.Pool({ connectionString: databaseUrl });
const kafka = new Kafka({ clientId: "analytics-consumer", brokers });
const consumer = kafka.consumer({ groupId: "analytics-warehouse" });

let shutdownStarted = false;

async function ingest(topic: string, envelope: ReturnType<typeof PlatformEventEnvelopeSchema.parse>): Promise<void> {
	await pool.query(
		`INSERT INTO analytics_events (id, topic, event_type, correlation_id, partition_key, payload, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
		[randomUUID(), topic, envelope.type, envelope.correlationId, envelope.type, JSON.stringify(envelope), envelope.occurredAt],
	);
}

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
		console.log(`Created Kafka topics: ${missingTopics.join(", ")}`);
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
				console.warn(`Kafka subscribe attempt ${String(attempt)} failed (${lastError.message}) — retrying…`);
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

	const shutdownTimeoutMs: number = readShutdownTimeoutMs();
	console.log(`\nReceived ${signal} — shutting down analytics consumer (timeout ${String(shutdownTimeoutMs)}ms)…`);

	const forceExitTimer: NodeJS.Timeout = setTimeout((): void => {
		console.error(`Shutdown timed out after ${String(shutdownTimeoutMs)}ms — forcing exit`);
		process.exit(1);
	}, shutdownTimeoutMs);

	try {
		await consumer.disconnect();
		await pool.end();
		clearTimeout(forceExitTimer);
		console.log("Analytics consumer shut down — Kafka and Postgres connections closed");
		process.exit(0);
	} catch (error) {
		clearTimeout(forceExitTimer);
		const message = error instanceof Error ? error.message : String(error);
		console.error(`Shutdown failed: ${message}`);
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
	console.log(`Analytics consumer subscribed to ${KAFKA_TOPICS.join(", ")}`);

	await consumer.run({
		eachMessage: async ({ topic, message }): Promise<void> => {
			if (message.value === null) {
				return;
			}
			const parsed = PlatformEventEnvelopeSchema.parse(JSON.parse(message.value.toString()));
			await ingest(topic, parsed);
		},
	});
}

main().catch((error: Error): void => {
	console.error(error.message);
	process.exit(1);
});
