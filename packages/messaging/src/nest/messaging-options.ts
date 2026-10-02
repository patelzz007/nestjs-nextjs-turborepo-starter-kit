/**
 * Connection settings are EXPLICIT: the app validates its own environment
 * (e.g. apps/api `config/api-config.schema.ts`) and passes the values in.
 * This package never reads `process.env` — `undefined` means "disabled".
 */
export interface MessagingModuleOptions {
	/** Kafka / kafkajs client id (e.g. `my-api`). */
	readonly clientId: string;
	/** ioredis `connectionName` (shows in Redis MONITOR / logs). */
	readonly connectionName: string;
	/** BullMQ queue names your app registers processors for. */
	readonly queueNames: readonly string[];
	/** Bull key prefix — default `bull`. */
	readonly bullPrefix?: string;
	/** Redis URL; `undefined` disables Redis + BullMQ. */
	readonly redisUrl: string | undefined;
	/** Kafka bootstrap servers; `undefined` (or empty) disables the producer. */
	readonly kafkaBrokers: readonly string[] | undefined;
	/** RabbitMQ URL; `undefined` disables the placeholder service. */
	readonly rabbitmqUrl: string | undefined;
	/** Queue polled for BullMQ health checks — defaults to first queue name. */
	readonly healthQueueName?: string;
}

export interface ResolvedMessagingOptions {
	readonly clientId: string;
	readonly connectionName: string;
	readonly queueNames: readonly string[];
	readonly bullPrefix: string;
	readonly redisUrl: string | undefined;
	readonly kafkaBrokers: readonly string[] | undefined;
	readonly rabbitmqUrl: string | undefined;
	readonly healthQueueName: string | undefined;
}

const DEFAULT_BULL_PREFIX = "bull";

/** Applies defaults and normalizes "configured but empty" to disabled. */
export function resolveMessagingOptions(options: MessagingModuleOptions): ResolvedMessagingOptions {
	return {
		clientId: options.clientId,
		connectionName: options.connectionName,
		queueNames: options.queueNames,
		bullPrefix: options.bullPrefix ?? DEFAULT_BULL_PREFIX,
		redisUrl: options.redisUrl !== undefined && options.redisUrl.length > 0 ? options.redisUrl : undefined,
		kafkaBrokers: options.kafkaBrokers !== undefined && options.kafkaBrokers.length > 0 ? options.kafkaBrokers : undefined,
		rabbitmqUrl: options.rabbitmqUrl !== undefined && options.rabbitmqUrl.length > 0 ? options.rabbitmqUrl : undefined,
		healthQueueName: options.healthQueueName ?? options.queueNames[0],
	};
}
