#!/usr/bin/env node
/**
 * Wait until every URL answers 2xx/3xx (readiness), or exit 1 after the
 * timeout listing what each pending URL last answered.
 *
 *   node packages/tooling/scripts/wait-for-http.mjs --timeout-ms 120000 http://localhost:8080/health/ready http://localhost:3000/
 */
import { setTimeout as delay } from "node:timers/promises";

import { REQUEST_TIMEOUT_MS, waitForHttp } from "./lib/wait-for-http.mjs";

const DEFAULT_TIMEOUT_MS = 120_000;

function parseArgs(argv) {
	const timeoutIndex = argv.indexOf("--timeout-ms");
	const timeoutMs = timeoutIndex === -1 ? DEFAULT_TIMEOUT_MS : Number(argv[timeoutIndex + 1]);
	if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
		throw new Error("--timeout-ms must be a positive integer");
	}
	const urls = argv.filter((arg, index) => !arg.startsWith("--") && index !== timeoutIndex + 1);
	if (urls.length === 0) {
		throw new Error("pass at least one URL");
	}
	for (const url of urls) {
		new URL(url); // throws on a malformed URL
	}
	return { timeoutMs, urls };
}

async function main() {
	const { timeoutMs, urls } = parseArgs(process.argv.slice(2));
	const result = await waitForHttp({
		urls,
		timeoutMs,
		fetchStatus: async (url) => (await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })).status,
		now: () => Date.now(),
		sleep: (ms) => delay(ms),
	});
	if (result.ready) {
		console.log(`Ready: ${urls.join(", ")}`);
		return;
	}
	console.error(`Not ready after ${String(timeoutMs)} ms:`);
	for (const { url, lastState } of result.pending) {
		console.error(`  - ${url}: ${lastState}`);
	}
	process.exitCode = 1;
}

main().catch((error) => {
	console.error(`wait-for-http failed: ${error instanceof Error ? error.message : String(error)}`);
	process.exitCode = 1;
});
