// ============================================
// platform/infrastructure/rate-limiting/rate-limit-scripts.ts — the atomic Lua scripts (ADR 071)
// ============================================
// Each decision is ONE script: reading, counting and setting the expiry happen together, so a counter
// can never be left without its expiry (the INCR-then-PEXPIRE bug this replaces). Time is Redis
// `TIME`, so every API instance agrees on the window. Replies are integer arrays.

import { createHash } from "node:crypto";

export interface RateLimitScript {
	readonly source: string;
	readonly sha: string;
}

function script(source: string): RateLimitScript {
	return { source, sha: createHash("sha1").update(source).digest("hex") };
}

/**
 * KEYS: window base, penalty, strikes, penalty level.
 * ARGV: limit, windowMs, cost, penalty on (1/0), strike threshold, strike window ms, reset after ms,
 * step count, then each step's ms.
 * Reply: allowed, remaining, reset ms, retry ms, penalized.
 */
export const SLIDING_WINDOW_SCRIPT: RateLimitScript = script(`
local penaltyOn = ARGV[4] == "1"
local t = redis.call("TIME")
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
if penaltyOn then
	local left = redis.call("PTTL", KEYS[2])
	if left > 0 then return {0, 0, left, left, 1} end
end
local limit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local window = math.floor(now / windowMs)
local elapsed = now - window * windowMs
local current = tonumber(redis.call("GET", KEYS[1] .. ":" .. window) or "0")
local previous = tonumber(redis.call("GET", KEYS[1] .. ":" .. (window - 1)) or "0")
local used = previous * ((windowMs - elapsed) / windowMs) + current
if used + cost > limit then
	local retry = windowMs - elapsed
	local room = limit - current - cost
	if previous > 0 and room >= 0 then
		retry = math.ceil(windowMs * (1 - room / previous)) - elapsed
	end
	if retry < 1 then retry = 1 end
	if penaltyOn then
		local resetAfterMs = tonumber(ARGV[7])
		local strikes = redis.call("INCR", KEYS[3])
		if strikes == 1 then redis.call("PEXPIRE", KEYS[3], tonumber(ARGV[6])) end
		redis.call("PEXPIRE", KEYS[4], resetAfterMs)
		if strikes >= tonumber(ARGV[5]) then
			local level = redis.call("INCR", KEYS[4])
			redis.call("PEXPIRE", KEYS[4], resetAfterMs)
			local steps = tonumber(ARGV[8])
			if level > steps then level = steps end
			local duration = tonumber(ARGV[8 + level])
			redis.call("SET", KEYS[2], "1", "PX", duration)
			redis.call("DEL", KEYS[3])
			return {0, 0, duration, duration, 1}
		end
	end
	return {0, 0, windowMs - elapsed, retry, 0}
end
local key = KEYS[1] .. ":" .. window
redis.call("INCRBY", key, cost)
redis.call("PEXPIRE", key, windowMs * 2)
return {1, math.floor(limit - used - cost), windowMs - elapsed, 0, 0}
`);

/**
 * GCRA. KEYS: bucket. ARGV: emission interval ms (one unit), burst, cost.
 * Reply: allowed, remaining, reset ms, retry ms.
 */
export const TOKEN_BUCKET_SCRIPT: RateLimitScript = script(`
local emission = tonumber(ARGV[1])
local burst = tonumber(ARGV[2])
local cost = tonumber(ARGV[3])
local t = redis.call("TIME")
local now = tonumber(t[1]) * 1000 + tonumber(t[2]) / 1000
local tat = tonumber(redis.call("GET", KEYS[1]) or "0")
if tat < now then tat = now end
local tolerance = emission * burst
local newTat = tat + emission * cost
local allowAt = newTat - tolerance
if allowAt > now then
	return {0, 0, math.ceil(tat - now), math.ceil(allowAt - now)}
end
redis.call("SET", KEYS[1], string.format("%.3f", newTat), "PX", math.max(1, math.ceil(newTat - now)))
return {1, math.floor((tolerance - (newTat - now)) / emission), math.ceil(newTat - now), 0}
`);

/**
 * KEYS: leases (sorted set, score = expiry). ARGV: limit, lease ms, lease id.
 * Reply: acquired, retry ms.
 */
export const CONCURRENCY_SCRIPT: RateLimitScript = script(`
local t = redis.call("TIME")
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", now)
if redis.call("ZCARD", KEYS[1]) >= tonumber(ARGV[1]) then
	local first = redis.call("ZRANGE", KEYS[1], 0, 0, "WITHSCORES")
	return {0, math.max(1, math.ceil(tonumber(first[2]) - now))}
end
local leaseMs = tonumber(ARGV[2])
redis.call("ZADD", KEYS[1], now + leaseMs, ARGV[3])
redis.call("PEXPIRE", KEYS[1], leaseMs)
return {1, 0}
`);
