import { randomUUID } from "node:crypto";

import { BullMqPrefixEnvSchema, RedisNamespaceEnvSchema } from "../../src/config/api-env.fields";

/**
 * Per-run BullMQ isolation for e2e.
 *
 * Every queue and worker key lives under `BULLMQ_PREFIX`. A developer's
 * running API uses the default `bull` prefix on the SAME Redis, so an e2e run
 * that also used `bull` would have its jobs stolen by that API's workers (and
 * vice versa). Each e2e run therefore gets its own prefix — `e2e:<uuid>`, or
 * the `E2E_BULLMQ_PREFIX` a runner (ci:local) chose — and deletes its keys
 * when the run ends.
 */

/** Namespace of every e2e run's BullMQ keys. */
export const E2E_BULLMQ_PREFIX_NAMESPACE = "e2e";

/**
 * Suffix turning a run's BullMQ prefix into its REDIS_NAMESPACE. A separate
 * namespace (`<prefix>-kv`, not `<prefix>:…`) keeps the API's own keys out of
 * BullMQ's `<prefix>:<queue>:…` keyspace whatever a queue is named.
 */
const E2E_REDIS_NAMESPACE_SUFFIX = "-kv";

/** Keys deleted per SCAN page / DEL call while purging a finished run. */
const PURGE_SCAN_COUNT = 500;

/** The prefix for this run: the runner's `E2E_BULLMQ_PREFIX`, else a fresh `e2e:<uuid>`. Never the shared default `bull`. */
export function resolveE2eBullMqPrefix(requested: string | undefined): string {
	const prefix = BullMqPrefixEnvSchema.parse(requested ?? `${E2E_BULLMQ_PREFIX_NAMESPACE}:${randomUUID()}`);
	if (!prefix.startsWith(`${E2E_BULLMQ_PREFIX_NAMESPACE}:`) && !prefix.startsWith("ci-local:")) {
		throw new Error(`E2E_BULLMQ_PREFIX must start with "${E2E_BULLMQ_PREFIX_NAMESPACE}:" or "ci-local:" so a run can never share (or purge) a real queue prefix`);
	}
	return prefix;
}

/**
 * This run's REDIS_NAMESPACE (every raw Redis key and pub/sub channel of the
 * API, e.g. `authz:invalidate`), derived from its BullMQ prefix — so a dev API
 * on the same Redis never hears this run's authorization invalidations or
 * reads its cached sessions, and ci:local's `E2E_BULLMQ_PREFIX` isolates both.
 */
export function e2eRedisNamespaceFor(bullMqPrefix: string): string {
	return RedisNamespaceEnvSchema.parse(`${resolveE2eBullMqPrefix(bullMqPrefix)}${E2E_REDIS_NAMESPACE_SUFFIX}`);
}

/** The two Redis commands the purge needs — an ioredis client satisfies it. */
export interface PurgeableRedis {
	scan(cursor: string, matchToken: "MATCH", pattern: string, countToken: "COUNT", count: number): Promise<[cursor: string, keys: string[]]>;
	del(...keys: string[]): Promise<number>;
}

/** Delete every key of a finished run (`<prefix>:*`). Returns how many were deleted. */
export async function purgeBullMqPrefix(redis: PurgeableRedis, prefix: string): Promise<number> {
	let cursor = "0";
	let deleted = 0;
	do {
		const [next, keys] = await redis.scan(cursor, "MATCH", `${prefix}:*`, "COUNT", PURGE_SCAN_COUNT);
		if (keys.length > 0) {
			deleted += await redis.del(...keys);
		}
		cursor = next;
	} while (cursor !== "0");
	return deleted;
}
