// `pnpm --filter @workspace/analytics-consumer kafka:provision-topics`
// Creates every missing platform.* topic with KAFKA_TOPIC_PARTITIONS,
// KAFKA_TOPIC_REPLICATION_FACTOR and KAFKA_TOPIC_RETENTION_DAYS, then verifies
// the shape of every topic. Idempotent; never alters an existing topic.
import { provisionKafkaTopics } from "@workspace/messaging/kafka";
import { EnvValidationError } from "@workspace/shared";

import { loadTopicProvisioningEnv } from "../env";
import { createKafkaClient, platformTopicSpecs } from "../kafka";
import { createConsoleJsonLogger } from "../logger";

const SERVICE_NAME = "analytics-consumer.kafka-provision-topics";
const FAILURE_EXIT_CODE = 1;

async function run(): Promise<void> {
	const logger = createConsoleJsonLogger(SERVICE_NAME);
	try {
		const env = loadTopicProvisioningEnv();
		const kafkaClient = createKafkaClient(env.kafka, logger);
		const admin = kafkaClient.kafka.admin();
		await admin.connect();
		try {
			const specs = platformTopicSpecs(env.partitions, env.replicationFactor, env.kafka.topicRetentionDays);
			const result = await provisionKafkaTopics(admin, specs, env.kafka.adminTimeoutMs);
			logger.info({
				event: "analytics.kafka_topics_provisioned",
				created: result.created.join(","),
				alreadyPresent: result.alreadyPresent.join(","),
				partitions: env.partitions,
				replicationFactor: env.replicationFactor,
				retentionDays: env.kafka.topicRetentionDays,
			});
		} finally {
			await admin.disconnect();
			kafkaClient.flushLogs();
		}
	} catch (error) {
		if (error instanceof EnvValidationError) {
			process.stderr.write(`${error.message}\n`);
		} else {
			logger.error({ event: "analytics.kafka_topic_provisioning_failed", error: error instanceof Error ? error.message : String(error) });
		}
		process.exitCode = FAILURE_EXIT_CODE;
	}
}

void run();
