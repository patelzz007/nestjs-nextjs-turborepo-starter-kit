// ── e2e global setup: per-run Redis isolation ─────────────────────────────
// Runs once per e2e run, in the main process, through Vitest's module runner
// (so it may import the TypeScript source graph). It decides this run's
// BullMQ key prefix and REDIS_NAMESPACE, provides them to every test file
// (test/setup-env.ts sets BULLMQ_PREFIX / REDIS_NAMESPACE from them before the
// app config is parsed), and deletes the run's keys from Redis when it ends.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import Redis from "ioredis";
import type { TestProject } from "vitest/node";

import { e2eRedisNamespaceFor, purgeBullMqPrefix, resolveE2eBullMqPrefix } from "./support/e2e-bullmq-prefix";

declare module "vitest" {
	export interface ProvidedContext {
		/** This run's BullMQ key prefix (`e2e:<uuid>` or the runner's E2E_BULLMQ_PREFIX). */
		bullMqPrefix: string;
		/** This run's REDIS_NAMESPACE (`<bullMqPrefix>-kv`): the API's raw keys and pub/sub channels. */
		redisNamespace: string;
	}
}

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export default function setup(project: TestProject): () => Promise<void> {
	const prefix = resolveE2eBullMqPrefix(process.env.E2E_BULLMQ_PREFIX);
	const redisNamespace = e2eRedisNamespaceFor(prefix);
	project.provide("bullMqPrefix", prefix);
	project.provide("redisNamespace", redisNamespace);

	return async (): Promise<void> => {
		loadEnv({ path: path.join(apiRoot, ".env"), quiet: true });
		const redisUrl = process.env.REDIS_URL;
		if (redisUrl === undefined) {
			return;
		}
		const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
		try {
			await redis.connect();
			const deleted = await purgeBullMqPrefix(redis, prefix);
			const deletedApiKeys = await purgeBullMqPrefix(redis, redisNamespace);
			console.warn(`e2e: deleted ${String(deleted)} BullMQ keys under "${prefix}:" and ${String(deletedApiKeys)} API keys under "${redisNamespace}:"`);
		} finally {
			redis.disconnect();
		}
	};
}
