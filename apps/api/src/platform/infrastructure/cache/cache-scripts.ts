// ============================================
// platform/infrastructure/cache/cache-scripts.ts — atomic writes and tag invalidation (ADR 072)
// ============================================

import { createHash } from "node:crypto";

export interface CacheScript {
	readonly source: string;
	readonly sha: string;
}

function script(source: string): CacheScript {
	return { source, sha: createHash("sha1").update(source).digest("hex") };
}

/**
 * Stores one value within the cache's key budget. Every key gets an expiry (one Redis for queues and
 * cache runs `noeviction`, so nothing may live for ever).
 * KEYS: value, index, then each tag set. ARGV: payload, ttl ms, budget.
 * Reply: 1 stored, 0 refused (budget full).
 */
export const CACHE_WRITE_SCRIPT: CacheScript = script(`
local t = redis.call("TIME")
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local ttl = tonumber(ARGV[2])
redis.call("ZREMRANGEBYSCORE", KEYS[2], "-inf", now)
if not redis.call("ZSCORE", KEYS[2], KEYS[1]) and redis.call("ZCARD", KEYS[2]) >= tonumber(ARGV[3]) then
	return 0
end
redis.call("SET", KEYS[1], ARGV[1], "PX", ttl)
redis.call("ZADD", KEYS[2], now + ttl, KEYS[1])
if redis.call("PTTL", KEYS[2]) < ttl then redis.call("PEXPIRE", KEYS[2], ttl) end
for i = 3, #KEYS do
	redis.call("SADD", KEYS[i], KEYS[1])
	if redis.call("PTTL", KEYS[i]) < ttl then redis.call("PEXPIRE", KEYS[i], ttl) end
end
return 1
`);

/**
 * Drops every value filed under one tag.
 * KEYS: tag set, index. Reply: the dropped value keys.
 */
export const CACHE_DROP_TAG_SCRIPT: CacheScript = script(`
local members = redis.call("SMEMBERS", KEYS[1])
for _, key in ipairs(members) do
	redis.call("DEL", key)
	redis.call("ZREM", KEYS[2], key)
end
redis.call("DEL", KEYS[1])
return members
`);

/**
 * Drops every value of one cache version.
 * KEYS: index. Reply: the dropped value keys.
 */
export const CACHE_DROP_ALL_SCRIPT: CacheScript = script(`
local members = redis.call("ZRANGE", KEYS[1], 0, -1)
for _, key in ipairs(members) do
	redis.call("DEL", key)
end
redis.call("DEL", KEYS[1])
return members
`);
