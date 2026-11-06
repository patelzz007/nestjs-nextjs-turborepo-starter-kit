// How long the last good run took, kept beside the hook's log. Only ever a hint for the time-left estimate: a missing
// or damaged file means no estimate, never a failed hook.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

import type { CheckProgress } from "./progress.ts";

const RunHistorySchema = z.object({
	totalMs: z.number(),
	checks: z.record(z.string(), z.number()),
});

/** The last good run: its whole length, and each check's by id. */
export type RunHistory = z.infer<typeof RunHistorySchema>;

export interface RunEstimate {
	/** How far through the run this is, from 0 to 1. */
	readonly fraction: number;
	/** Undefined with no earlier run to go by. */
	readonly remainingMs: number | undefined;
}

const JSON_INDENT = "\t";

export function readRunHistory(file: string): RunHistory | undefined {
	try {
		return RunHistorySchema.parse(JSON.parse(readFileSync(file, "utf8")));
	} catch {
		return undefined;
	}
}

export function writeRunHistory(file: string, checks: readonly CheckProgress[], totalMs: number): void {
	const history: RunHistory = { totalMs, checks: Object.fromEntries(checks.map((check) => [check.id, check.elapsedMs])) };
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, `${JSON.stringify(history, undefined, JSON_INDENT)}\n`);
}

function checkFraction(check: CheckProgress): number {
	if (check.status === "passed" || check.status === "failed") {
		return 1;
	}
	if (check.status === "waiting" || check.packagesTotal === undefined || check.packagesTotal === 0) {
		return 0;
	}
	return Math.min([...check.packages.values()].filter((item) => item.startedAtMs !== undefined).length / check.packagesTotal, 1);
}

/** Without a known check length, the time left can't be told: count checks and packages instead. */
function countedEstimate(checks: readonly CheckProgress[]): RunEstimate {
	const done = checks.reduce((sum, check) => sum + checkFraction(check), 0);
	return { fraction: checks.length === 0 ? 0 : done / checks.length, remainingMs: undefined };
}

function remainingOf(check: CheckProgress, expectedMs: number, nowMs: number): number {
	if (check.status === "waiting") {
		return expectedMs;
	}
	return check.status === "running" ? Math.max(expectedMs - (nowMs - (check.startedAtMs ?? nowMs)), 0) : 0;
}

/** How far along the run is, going by how long each check took last time. */
export function estimateRun(checks: readonly CheckProgress[], history: RunHistory | undefined, nowMs: number): RunEstimate {
	const expected = checks.map((check) => ({ check, expectedMs: history?.checks[check.id] }));
	const totalMs = expected.reduce((sum, item) => sum + (item.expectedMs ?? 0), 0);
	if (totalMs === 0 || expected.some((item) => item.expectedMs === undefined)) {
		return countedEstimate(checks);
	}
	const remainingMs = expected.reduce((sum, { check, expectedMs }) => sum + remainingOf(check, expectedMs ?? 0, nowMs), 0);
	return { fraction: 1 - remainingMs / totalMs, remainingMs };
}
