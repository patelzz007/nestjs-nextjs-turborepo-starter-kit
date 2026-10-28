// The load runner's entry point: one BullMQ worker on `operations.load-test`, one run at a time.
//   REDIS_URL=… pnpm --filter @workspace/load-runner start   (or `pnpm load-runner`: the Docker service)

import { spawn } from "node:child_process";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createBullMqConnection } from "@workspace/messaging";
import { LoadTestJobSchema, QUEUE_NAMES, type LoadTestOutcome } from "@workspace/shared";
import { Worker } from "bullmq";
import { Redis } from "ioredis";

import { loadRunnerEnv } from "./env";
import { runLoadTest, type K6Process } from "./run-load-test";

const env = loadRunnerEnv();
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
/** Bytes of each k6 output file already read. */
const offsets = new Map<string, number>();
/** A partial line at the end of the last read, completed by the next. */
const remainders = new Map<string, string>();

async function readNewLines(path: string): Promise<readonly string[]> {
	const handle = await open(path, "r").catch(() => null);
	if (handle === null) {
		return [];
	}
	try {
		const start: number = offsets.get(path) ?? 0;
		const { size } = await handle.stat();
		if (size <= start) {
			return [];
		}
		const buffer = Buffer.alloc(size - start);
		await handle.read(buffer, 0, buffer.length, start);
		offsets.set(path, size);
		const text = (remainders.get(path) ?? "") + buffer.toString("utf8");
		const lines = text.split("\n");
		remainders.set(path, lines.pop() ?? "");
		return lines;
	} finally {
		await handle.close();
	}
}

function startK6(paths: { readonly scriptPath: string; readonly configPath: string; readonly outputPath: string }): K6Process {
	const child = spawn(
		env.K6_BINARY,
		["run", "--quiet", "--no-summary", "--no-usage-report", "--out", `json=${paths.outputPath}`, "-e", `LOAD_TEST_CONFIG=${paths.configPath}`, paths.scriptPath],
		{
			stdio: env.K6_VERBOSE ? "inherit" : "ignore",
		},
	);
	return {
		exited: new Promise((resolve) => {
			child.once("error", (error: Error) => {
				console.error(`k6 could not start: ${error.message}`);
				resolve(1);
			});
			child.once("close", (code: number | null) => {
				resolve(code ?? 1);
			});
		}),
		stop: (): void => {
			child.kill("SIGINT");
		},
	};
}

const worker = new Worker(
	QUEUE_NAMES.operationsLoadTest,
	async (job): Promise<LoadTestOutcome> => {
		console.log(`Load test ${String(job.id)} started`);
		const outcome = await runLoadTest(LoadTestJobSchema.parse(job.data), {
			targetOverride: env.LOAD_TEST_TARGET_URL,
			prepare: async (script, config) => {
				const directory = await mkdtemp(join(tmpdir(), "load-test-"));
				const scriptPath = join(directory, "script.js");
				const configPath = join(directory, "config.json");
				await writeFile(scriptPath, script);
				await writeFile(configPath, config);
				return { scriptPath, configPath, outputPath: join(directory, "results.jsonl"), cleanup: (): Promise<void> => rm(directory, { recursive: true, force: true }) };
			},
			startK6,
			readNewLines,
			isStopRequested: async (abortKey) => (await redis.exists(abortKey)) === 1,
			reportProgress: (progress) => job.updateProgress(progress),
			now: Date.now,
			sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
		});
		console.log(`Load test ${String(job.id)} ended: ${outcome.status}, ${String(outcome.totals.requests)} requests`);
		return outcome;
	},
	{ connection: createBullMqConnection(env.REDIS_URL), prefix: env.BULLMQ_PREFIX, concurrency: 1 },
);

async function shutdown(): Promise<void> {
	await worker.close();
	redis.disconnect();
	console.log("Load runner stopped.");
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
console.log(`Load runner waiting for load tests on ${QUEUE_NAMES.operationsLoadTest}`);
