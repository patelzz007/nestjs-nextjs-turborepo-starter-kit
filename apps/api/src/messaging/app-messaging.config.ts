import { ALL_QUEUE_NAMES, QUEUE_NAMES } from "@workspace/shared";

import type { MessagingModuleOptions } from "@workspace/messaging/nest";

import type { MessagingConfig } from "../config/api-config.schema";

/**
 * App-specific messaging wiring — copy this file to a new project and edit
 * queue names only. Connection settings come from the validated config
 * (`REDIS_URL`, `KAFKA_BROKERS`, `KAFKA_SSL*` / `KAFKA_SASL_*`,
 * `KAFKA_DELIVERY_TIMEOUT_MS`, `RABBITMQ_URL`, `MESSAGING_*`, `BULLMQ_PREFIX`).
 */
export function buildAppMessagingConfig(config: MessagingConfig): MessagingModuleOptions {
	return {
		clientId: config.clientId,
		connectionName: config.connectionName,
		queueNames: ALL_QUEUE_NAMES,
		// One prefix for every queue and worker (BullModule.forRoot) — `BULLMQ_PREFIX`.
		bullPrefix: config.bullPrefix,
		healthQueueName: QUEUE_NAMES.emailSend,
		redisUrl: config.redisUrl,
		kafkaBrokers: config.kafkaBrokers,
		kafkaSecurity: config.kafkaSecurity,
		kafkaDeliveryTimeoutMs: config.kafkaDeliveryTimeoutMs,
		rabbitmqUrl: config.rabbitmqUrl,
	};
}
