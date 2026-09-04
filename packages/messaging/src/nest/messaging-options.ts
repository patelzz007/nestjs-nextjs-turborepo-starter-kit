import type { MessagingEnvKeys } from "../core/env";

export interface MessagingModuleOptions {
	/** Kafka / kafkajs client id (e.g. `my-api`). */
	readonly clientId: string;
	/** ioredis `connectionName` (shows in Redis MONITOR / logs). */
	readonly connectionName: string;
	/** BullMQ queue names your app registers processors for. */
	readonly queueNames: readonly string[];
	/** Bull key prefix — default `bull`. */
	readonly bullPrefix?: string;
	/** Explicit Redis URL — falls back to `REDIS_URL` env when omitted. */
	readonly redisUrl?: string;
	/** Explicit Kafka brokers — falls back to `KAFKA_BROKERS` env when omitted. */
	readonly kafkaBrokers?: readonly string[];
	/** Explicit RabbitMQ URL — falls back to `RABBITMQ_URL` env when omitted. */
	readonly rabbitmqUrl?: string;
	/** Env var names when resolving from `process.env`. */
	readonly envKeys?: MessagingEnvKeys;
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

export function resolveMessagingOptions(options: MessagingModuleOptions): ResolvedMessagingOptions {
	const envKeys = options.envKeys;
	const redisFromEnv = envKeys !== undefined ? process.env[envKeys.redisUrl] : process.env.REDIS_URL;
	const kafkaFromEnv = envKeys !== undefined ? process.env[envKeys.kafkaBrokers] : process.env.KAFKA_BROKERS;
	const rabbitFromEnv = envKeys !== undefined ? process.env[envKeys.rabbitmqUrl] : process.env.RABBITMQ_URL;

	const kafkaBrokers =
		options.kafkaBrokers ??
		(kafkaFromEnv !== undefined && kafkaFromEnv.length > 0
			? kafkaFromEnv
					.split(",")
					.map((broker) => broker.trim())
					.filter((broker) => broker.length > 0)
			: undefined);

	return {
		clientId: options.clientId,
		connectionName: options.connectionName,
		queueNames: options.queueNames,
		bullPrefix: options.bullPrefix ?? "bull",
		redisUrl: options.redisUrl ?? (redisFromEnv !== undefined && redisFromEnv.length > 0 ? redisFromEnv : undefined),
		kafkaBrokers: kafkaBrokers !== undefined && kafkaBrokers.length > 0 ? kafkaBrokers : undefined,
		rabbitmqUrl: options.rabbitmqUrl ?? (rabbitFromEnv !== undefined && rabbitFromEnv.length > 0 ? rabbitFromEnv : undefined),
		healthQueueName: options.healthQueueName ?? options.queueNames[0],
	};
}
