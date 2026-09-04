import { randomUUID } from "node:crypto";

import { KAFKA_TOPICS, PlatformEventEnvelopeSchema } from "@workspace/shared";
import { Kafka } from "kafkajs";
import pg from "pg";

const databaseUrl: string | undefined = process.env.DATABASE_URL;
const kafkaBrokersRaw: string | undefined = process.env.KAFKA_BROKERS;

if (databaseUrl === undefined || databaseUrl.length === 0) {
	throw new Error("DATABASE_URL is required");
}

if (kafkaBrokersRaw === undefined || kafkaBrokersRaw.length === 0) {
	throw new Error("KAFKA_BROKERS is required");
}

const brokers: string[] = kafkaBrokersRaw
	.split(",")
	.map((broker) => broker.trim())
	.filter((broker) => broker.length > 0);

const pool = new pg.Pool({ connectionString: databaseUrl });
const kafka = new Kafka({ clientId: "analytics-consumer", brokers });
const consumer = kafka.consumer({ groupId: "analytics-warehouse" });

async function ingest(topic: string, envelope: ReturnType<typeof PlatformEventEnvelopeSchema.parse>): Promise<void> {
	await pool.query(
		`INSERT INTO analytics_events (id, topic, event_type, correlation_id, partition_key, payload, occurred_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
		[
			randomUUID(),
			topic,
			envelope.type,
			envelope.correlationId,
			envelope.type,
			JSON.stringify(envelope),
			envelope.occurredAt,
		],
	);
}

async function main(): Promise<void> {
	await consumer.connect();
	await consumer.subscribe({ topics: [...KAFKA_TOPICS], fromBeginning: false });
	console.log(`Analytics consumer subscribed to ${KAFKA_TOPICS.join(", ")}`);

	await consumer.run({
		eachMessage: async ({ topic, message }) => {
			if (message.value === null) {
				return;
			}
			const parsed = PlatformEventEnvelopeSchema.parse(JSON.parse(message.value.toString()));
			await ingest(topic, parsed);
		},
	});
}

main().catch((error: Error) => {
	console.error(error.message);
	process.exit(1);
});
