import type { RedisOptions } from "ioredis";

export interface RedisClientOptionsInput {
	readonly redisUrl: string;
	readonly connectionName: string;
}

/** Shared ioredis options for cache pub/sub and BullMQ. */
/**
 * Options for `new Redis(url, options)`. `replyMapping` is left out on purpose:
 * ioredis types it `ReplyMappingMode | undefined` on `RedisOptions` but its
 * constructor only accepts an absent key, so under `exactOptionalPropertyTypes`
 * the full `RedisOptions` type is not assignable to the constructor. We never
 * set it.
 */
export type RedisClientOptions = Omit<RedisOptions, "replyMapping">;

export function createRedisClientOptions(input: RedisClientOptionsInput): RedisClientOptions {
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
