// How long the last good run took, kept beside the hook's log, with the best time and the run of passes. Only ever a
// hint for the time-left estimate and the closing report: a missing or damaged file means no estimate, never a failed
// hook.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

import { formatDuration } from "../shared/format-duration.ts";
import type { CheckProgress } from "./progress.ts";
import { formatCount } from "./text.ts";

const RunHistorySchema = z.object({
	totalMs: z.number(),
	checks: z.record(z.string(), z.number()),
	/** The fastest good run. Files written before it was recorded fall back to `totalMs`. */
	bestMs: z.number().optional(),
	/** Good runs in a row, up to the last one. Older files start counting again. */
	streak: z.number().int().nonnegative().optional(),
});

/** The last good run: its whole length, and each check's by id; the best time; the passes in a row. */
export type RunHistory = z.infer<typeof RunHistorySchema>;

/** How a run ended, as far as its history is concerned. A cancelled run is not recorded at all. */
export interface FinishedRun {
	readonly passed: boolean;
	readonly checks: readonly CheckProgress[];
	readonly totalMs: number;
}

/** A shorter streak is just the usual, not worth a line. */
const STREAK_WORTH_MENTIONING = 2;
/** A smaller difference from the last run is just noise. */
const MS_WORTH_MENTIONING = 5000;

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

function bestOf(previous: RunHistory | undefined): number | undefined {
	return previous?.bestMs ?? previous?.totalMs;
}

/**
 * The history after this run. A pass replaces the timings, which only a complete run can give, and extends the streak;
 * a failure keeps the last good timings for the estimate and ends the streak.
 */
export function nextRunHistory(previous: RunHistory | undefined, { passed, checks, totalMs }: FinishedRun): RunHistory | undefined {
	if (!passed) {
		return previous === undefined ? undefined : { ...previous, streak: 0 };
	}
	const best = bestOf(previous);
	return {
		totalMs,
		checks: Object.fromEntries(checks.map((check) => [check.id, check.elapsedMs])),
		bestMs: best === undefined ? totalMs : Math.min(best, totalMs),
		streak: (previous?.streak ?? 0) + 1,
	};
}

export function writeRunHistory(file: string, history: RunHistory): void {
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, `${JSON.stringify(history, undefined, JSON_INDENT)}\n`);
}

function comparedWithLast(totalMs: number, previousMs: number): string | undefined {
	if (Math.abs(totalMs - previousMs) < MS_WORTH_MENTIONING) {
		return undefined;
	}
	return `${formatDuration(Math.abs(totalMs - previousMs))} ${totalMs < previousMs ? "faster" : "slower"} than last time`;
}

/** What is worth saying about a good run against the ones before it: a new best, the change since last time, the streak. */
export function runRecords(previous: RunHistory | undefined, next: RunHistory | undefined, run: FinishedRun): readonly string[] {
	if (!run.passed || previous === undefined) {
		return [];
	}
	const best = bestOf(previous);
	const newBest = best !== undefined && run.totalMs < best ? `★ New best time, ${formatDuration(run.totalMs)} (was ${formatDuration(best)})` : undefined;
	const compared = newBest === undefined ? comparedWithLast(run.totalMs, previous.totalMs) : undefined;
	const streak = next?.streak ?? 0;
	const streakLine = streak < STREAK_WORTH_MENTIONING ? undefined : `● ${formatCount(streak)} green runs in a row`;
	return [newBest, compared, streakLine].filter((line) => line !== undefined);
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
