import { QUEUE_NAMES } from "@workspace/shared";

import type { MessagingModuleOptions } from "@workspace/messaging/nest";

import type { MessagingConfig } from "../config/api-config.schema";

/** BullMQ key prefix shared with Bull Board (compose.yml). */
const BULL_PREFIX = "bull";

/**
 * App-specific messaging wiring — copy this file to a new project and edit
 * queue names only. Connection settings come from the validated config
 * (`REDIS_URL`, `KAFKA_BROKERS`, `RABBITMQ_URL`, `MESSAGING_*`).
 */
export function buildAppMessagingConfig(config: MessagingConfig): MessagingModuleOptions {
	return {
		clientId: config.clientId,
		connectionName: config.connectionName,
		queueNames: QUEUE_NAMES,
		bullPrefix: BULL_PREFIX,
		healthQueueName: QUEUE_NAMES[0],
		redisUrl: config.redisUrl,
		kafkaBrokers: config.kafkaBrokers,
		rabbitmqUrl: config.rabbitmqUrl,
	};
}
