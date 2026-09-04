export interface MessagingEnvKeys {
	readonly redisUrl: string;
	readonly kafkaBrokers: string;
	readonly rabbitmqUrl: string;
}

export const DEFAULT_MESSAGING_ENV_KEYS: MessagingEnvKeys = {
	redisUrl: "REDIS_URL",
	kafkaBrokers: "KAFKA_BROKERS",
	rabbitmqUrl: "RABBITMQ_URL",
};

export interface ResolvedMessagingEnv {
	readonly redisUrl: string | undefined;
	readonly kafkaBrokers: readonly string[] | undefined;
	readonly rabbitmqUrl: string | undefined;
}

export function resolveMessagingEnv(keys: MessagingEnvKeys = DEFAULT_MESSAGING_ENV_KEYS): ResolvedMessagingEnv {
	const redisUrl = process.env[keys.redisUrl];
	const kafkaRaw = process.env[keys.kafkaBrokers];
	const rabbitmqUrl = process.env[keys.rabbitmqUrl];

	const kafkaBrokers =
		kafkaRaw === undefined || kafkaRaw.length === 0
			? undefined
			: kafkaRaw
					.split(",")
					.map((broker) => broker.trim())
					.filter((broker) => broker.length > 0);

	return {
		redisUrl: redisUrl !== undefined && redisUrl.length > 0 ? redisUrl : undefined,
		kafkaBrokers: kafkaBrokers !== undefined && kafkaBrokers.length > 0 ? kafkaBrokers : undefined,
		rabbitmqUrl: rabbitmqUrl !== undefined && rabbitmqUrl.length > 0 ? rabbitmqUrl : undefined,
	};
}
