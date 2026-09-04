import type { RedisOptions } from "ioredis";

export interface RedisClientOptionsInput {
	readonly redisUrl: string;
	readonly connectionName: string;
}

/** Shared ioredis options for cache pub/sub and BullMQ. */
export function createRedisClientOptions(input: RedisClientOptionsInput): RedisOptions {
	return {
		lazyConnect: true,
		maxRetriesPerRequest: 1,
		enableReadyCheck: true,
		connectTimeout: 10_000,
		connectionName: input.connectionName,
		...(input.redisUrl.startsWith("rediss://") ? { tls: {} } : {}),
	};
}

/** BullMQ connection block derived from the same Redis URL. */
export function createBullMqConnection(redisUrl: string): { url: string; maxRetriesPerRequest: null } {
	return {
		url: redisUrl,
		maxRetriesPerRequest: null,
	};
}

export function parseCommaSeparatedEnv(value: string | undefined): readonly string[] | undefined {
	if (value === undefined || value.length === 0) {
		return undefined;
	}
	const parts = value
		.split(",")
		.map((part) => part.trim())
		.filter((part) => part.length > 0);
	return parts.length > 0 ? parts : undefined;
}
