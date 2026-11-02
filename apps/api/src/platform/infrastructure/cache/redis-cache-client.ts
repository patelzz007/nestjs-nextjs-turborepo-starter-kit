// ============================================
// platform/infrastructure/cache/redis-cache-client.ts — what the cache needs of Redis
// ============================================

import type Redis from "ioredis";
import { z } from "zod";

import { CACHE_DROP_ALL_SCRIPT, CACHE_DROP_TAG_SCRIPT, CACHE_WRITE_SCRIPT, type CacheScript } from "./cache-scripts";

export interface RedisMemoryInfo {
	readonly usedBytes: number;
	/** `null` when Redis has no memory limit (`maxmemory 0`). */
	readonly maxBytes: number | null;
	readonly policy: string;
}

export interface CacheStoreClient {
	get(key: string): Promise<string | null>;
	/** Stores within the budget; false when the budget is full. */
	write(valueKey: string, indexKey: string, tagKeys: readonly string[], payload: string, ttlMs: number, budget: number): Promise<boolean>;
	/** Deletes values and removes them from their index. */
	drop(indexKey: string, valueKeys: readonly string[]): Promise<void>;
	/** Deletes everything filed under one tag; returns the dropped value keys. */
	dropTag(tagKey: string, indexKey: string): Promise<readonly string[]>;
	/** Deletes every value in one index; returns the dropped value keys. */
	dropAll(indexKey: string): Promise<readonly string[]>;
	/** Live keys in one index. */
	count(indexKey: string): Promise<number>;
	/** `SET NX PX`: true when this caller took the lease. */
	takeLease(leaseKey: string, ttlMs: number): Promise<boolean>;
	releaseLease(leaseKey: string): Promise<void>;
	publish(channel: string, message: string): Promise<void>;
	memory(): Promise<RedisMemoryInfo>;
}

const NumberReplySchema = z.number();
const KeysReplySchema = z.array(z.string());
const MemoryLinePattern = /^(?<field>used_memory|maxmemory|maxmemory_policy):(?<value>\S+)$/;

function isNoScriptError(error: Error): boolean {
	return error.message.startsWith("NOSCRIPT");
}

/** The shared ioredis client as a {@link CacheStoreClient}. Every reply is checked, never trusted. */
export function ioredisCacheClient(redis: Redis): CacheStoreClient {
	const run = async (script: CacheScript, keys: readonly string[], args: readonly (string | number)[]): Promise<string | number | string[]> => {
		const parsed = z.union([z.number(), z.string(), z.array(z.string())]);
		try {
			return parsed.parse(await redis.evalsha(script.sha, keys.length, ...keys, ...args));
		} catch (error) {
			if (error instanceof Error && isNoScriptError(error)) {
				return parsed.parse(await redis.eval(script.source, keys.length, ...keys, ...args));
			}
			throw error;
		}
	};
	return {
		get: (key: string): Promise<string | null> => redis.get(key),
		write: async (valueKey, indexKey, tagKeys, payload, ttlMs, budget): Promise<boolean> =>
			NumberReplySchema.parse(await run(CACHE_WRITE_SCRIPT, [valueKey, indexKey, ...tagKeys], [payload, ttlMs, budget])) === 1,
		drop: async (indexKey, valueKeys): Promise<void> => {
			if (valueKeys.length === 0) {
				return;
			}
			await redis
				.multi()
				.del(...valueKeys)
				.zrem(indexKey, ...valueKeys)
				.exec();
		},
		dropTag: async (tagKey, indexKey): Promise<readonly string[]> => KeysReplySchema.parse(await run(CACHE_DROP_TAG_SCRIPT, [tagKey, indexKey], [])),
		dropAll: async (indexKey): Promise<readonly string[]> => KeysReplySchema.parse(await run(CACHE_DROP_ALL_SCRIPT, [indexKey], [])),
		count: (indexKey: string): Promise<number> => redis.zcard(indexKey),
		takeLease: async (leaseKey, ttlMs): Promise<boolean> => (await redis.set(leaseKey, "1", "PX", ttlMs, "NX")) === "OK",
		releaseLease: async (leaseKey): Promise<void> => {
			await redis.del(leaseKey);
		},
		publish: async (channel, message): Promise<void> => {
			await redis.publish(channel, message);
		},
		memory: async (): Promise<RedisMemoryInfo> => {
			const fields = new Map<string, string>();
			for (const line of (await redis.info("memory")).split(/\r?\n/)) {
				const groups = MemoryLinePattern.exec(line)?.groups;
				if (groups?.field !== undefined && groups.value !== undefined) {
					fields.set(groups.field, groups.value);
				}
			}
			const maxBytes = Number(fields.get("maxmemory") ?? "0");
			return { usedBytes: Number(fields.get("used_memory") ?? "0"), maxBytes: maxBytes > 0 ? maxBytes : null, policy: fields.get("maxmemory_policy") ?? "unknown" };
		},
	};
}
