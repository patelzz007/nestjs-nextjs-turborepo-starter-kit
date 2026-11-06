// ── e2e global setup: per-run, per-worker isolation ───────────────────────
// Runs once per e2e run, in the main process, through Vitest's module runner
// (so it may import the TypeScript source graph). Test files run in parallel,
// one per worker, so it
//   - decides this run's BullMQ key prefix (each worker gets its own inside it,
//     and its REDIS_NAMESPACE from that — e2e/support/e2e-bullmq-prefix.ts),
//   - copies DATABASE_URL's database once per worker
//     (e2e/support/e2e-worker-databases.ts),
// provides both to every test file (e2e/setup-env.ts points DATABASE_URL,
// BULLMQ_PREFIX and REDIS_NAMESPACE at the worker's own before the app config
// is parsed), and when the run ends drops the copies and deletes the run's keys.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import Redis from "ioredis";
import { Pool } from "pg";
import type { TestProject } from "vitest/node";
import { z } from "zod";

import { apiEnvFilePath } from "../scripts/lib/env-file";
import { purgeBullMqPrefix, resolveE2eBullMqPrefix } from "./support/e2e-bullmq-prefix";
import { createWorkerDatabases, databaseNameOf, dropWorkerDatabases, newRunTag, withDatabaseName, workerDatabaseName } from "./support/e2e-worker-databases";
import { TEST_API_INFRASTRUCTURE } from "./support/test-api-env";

declare module "vitest" {
	export interface ProvidedContext {
		/** This run's BullMQ key prefix (`e2e:<uuid>` or the runner's E2E_BULLMQ_PREFIX); every worker's keys live under it. */
		bullMqPrefix: string;
		/** One database per worker, copied from DATABASE_URL's: worker `VITEST_POOL_ID` uses entry `VITEST_POOL_ID - 1`. */
		workerDatabaseUrls: string[];
	}
}

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Runs `work` with a single-connection pool on `url`, always closing it. */
async function withServer(url: string, work: (server: Pool) => Promise<void>): Promise<void> {
	const server = new Pool({ connectionString: url, max: 1 });
	try {
		await work(server);
	} finally {
		await server.end();
	}
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
	// The same precedence as e2e/setup-env.ts: the runner's environment, then apps/api/.env (or DOTENV_PATH), then the fixture.
	loadEnv({ path: apiEnvFilePath(apiRoot), quiet: true });
	const prefix = resolveE2eBullMqPrefix(process.env.E2E_BULLMQ_PREFIX);
	const sourceUrl = z
		.string()
		.min(1)
		.parse(process.env.DATABASE_URL ?? TEST_API_INFRASTRUCTURE.DATABASE_URL);
	const source = databaseNameOf(sourceUrl);
	const runTag = newRunTag();
	// `maxWorkers` as resolved for this run: 1 under `--no-file-parallelism`, the CLI's `--maxWorkers` when given.
	const workerDatabases = Array.from({ length: project.config.maxWorkers }, (_unused, index): string => workerDatabaseName(source, runTag, index + 1));
	// Copying and dropping databases are admin statements: they go to the direct session server when there is one
	// (behind a pooler, 2.5). A pooler keeps idle server connections to the source open, which a
	// `CREATE DATABASE … TEMPLATE` refuses, and the copies' own traffic still goes through the pooler.
	const adminUrl = process.env.DATABASE_SESSION_URL !== undefined && process.env.DATABASE_SESSION_URL.length > 0 ? process.env.DATABASE_SESSION_URL : sourceUrl;
	await withServer(adminUrl, async (server): Promise<void> => createWorkerDatabases(server, source, workerDatabases));

	project.provide("bullMqPrefix", prefix);
	project.provide(
		"workerDatabaseUrls",
		workerDatabases.map((name): string => withDatabaseName(sourceUrl, name)),
	);

	return async (): Promise<void> => {
		await withServer(adminUrl, async (server): Promise<void> => dropWorkerDatabases(server, workerDatabases));
		const redisUrl = process.env.REDIS_URL;
		if (redisUrl === undefined) {
			return;
		}
		const redis = new Redis(redisUrl, { lazyConnect: true, maxRetriesPerRequest: 1 });
		try {
			await redis.connect();
			// `<prefix>:*` holds every worker's BullMQ keys (`<prefix>:w<n>:…`) and API keys (`<prefix>:w<n>-kv:…`).
			const deleted = await purgeBullMqPrefix(redis, prefix);
			console.warn(`e2e: dropped ${String(workerDatabases.length)} worker database(s) and deleted ${String(deleted)} Redis keys under "${prefix}:"`);
		} finally {
			redis.disconnect();
		}
	};
}
