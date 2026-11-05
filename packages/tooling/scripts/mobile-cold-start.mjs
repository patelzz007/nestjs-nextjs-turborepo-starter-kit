#!/usr/bin/env node
// `pnpm --filter @workspace/mobile cold-start [-- --check]` (enhancement 6.6): how long the Android app on the
// connected phone or emulator takes to open from nothing, as the median of five launches (`am start -W`, each after
// stopping the app's process; its data is kept). `--check` fails when the median is over
// mobile-startup-budgets.json's `android.coldStartMs` (the nightly job, on a release build). Run from apps/mobile.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { COLD_START_RUNS, coldStartVerdict, forceStopArgs, launchArgs, launchFailureOf, medianMs, parseStartupBudgets, totalTimeMsOf } from "./lib/mobile-cold-start.mjs";
import { appIdOf } from "./lib/mobile-device-tests.mjs";

/** A stopped process needs a moment to be gone before the next launch counts as cold. */
const SETTLE_MS = 1500;
const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

function settle() {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT)), 0, 0, SETTLE_MS);
}

const config = spawnSync("npx", ["expo", "config", "--type", "public", "--json"], { encoding: "utf8" });
if (config.status !== 0) {
	process.stderr.write(config.stderr);
	process.exit(config.status ?? 1);
}
const appId = appIdOf(config.stdout);
const samples = [];
for (let run = 1; run <= COLD_START_RUNS; run += 1) {
	spawnSync("adb", forceStopArgs(appId), { stdio: "ignore" });
	settle();
	const launch = spawnSync("adb", launchArgs(appId), { encoding: "utf8" });
	const ms = totalTimeMsOf(launch.stdout);
	// A launch with no time is printed with why (a timeout is a slow start, not a pass), never dropped silently.
	process.stdout.write(
		`cold start ${String(run)}/${String(COLD_START_RUNS)}: ${ms === null ? `failed (${launchFailureOf(launch.stdout + launch.stderr)})` : `${String(ms)} ms`}\n`,
	);
	if (ms !== null) {
		samples.push(ms);
	}
}
const median = medianMs(samples);
process.stdout.write(`${appId}: median cold start ${String(median)} ms over ${String(samples.length)} launches\n`);
if (process.argv.includes("--check")) {
	const budgets = parseStartupBudgets(readFileSync(path.join(REPO_ROOT, "mobile-startup-budgets.json"), "utf8"));
	const verdict = coldStartVerdict(median, budgets.android.coldStartMs);
	process.stdout.write(`${verdict.ok ? "✓" : "✗"} budget ${String(verdict.budgetMs)} ms\n`);
	process.exit(verdict.ok ? 0 : 1);
}
