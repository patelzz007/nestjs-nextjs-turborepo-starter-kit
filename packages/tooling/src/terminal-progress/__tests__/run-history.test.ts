import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyLine, finishCheck, startCheck, waitingCheck } from "../progress.ts";
import { estimateRun, nextRunHistory, readRunHistory, runRecords, writeRunHistory } from "../run-history.ts";

const lint = waitingCheck("lint", "Lint", "lint");
const test = waitingCheck("test", "Unit tests", "test");
const HISTORY = { totalMs: 100_000, checks: { lint: 20_000, test: 80_000 } };

describe("run history file", () => {
	let folder: string;

	beforeEach(() => {
		folder = mkdtempSync(path.join(tmpdir(), "run-history-"));
	});

	afterEach(() => {
		rmSync(folder, { recursive: true, force: true });
	});

	it("reads back what it wrote", () => {
		const file = path.join(folder, "new/history.json");
		writeRunHistory(file, { totalMs: 6000, checks: { lint: 5000 }, bestMs: 6000, streak: 1 });

		expect(readRunHistory(file)).toStrictEqual({ totalMs: 6000, checks: { lint: 5000 }, bestMs: 6000, streak: 1 });
	});

	it("still reads a file from before the best time and the streak were kept", () => {
		const file = path.join(folder, "old.json");
		writeFileSync(file, JSON.stringify(HISTORY));

		expect(readRunHistory(file)).toStrictEqual(HISTORY);
	});

	it("gives nothing for a missing or damaged file: it's only ever a hint", () => {
		const damaged = path.join(folder, "damaged.json");
		writeFileSync(damaged, '{"totalMs":');

		expect(readRunHistory(path.join(folder, "missing.json"))).toBeUndefined();
		expect(readRunHistory(damaged)).toBeUndefined();
	});
});

describe("nextRunHistory", () => {
	const passedLint = [finishCheck(startCheck(lint, 0), true, 5000)];

	it("starts the best time and the streak on a first good run", () => {
		expect(nextRunHistory(undefined, { passed: true, checks: passedLint, totalMs: 6000 })).toStrictEqual({ totalMs: 6000, checks: { lint: 5000 }, bestMs: 6000, streak: 1 });
	});

	it("keeps the best time, and extends the streak", () => {
		const previous = { ...HISTORY, bestMs: 90_000, streak: 2 };

		expect(nextRunHistory(previous, { passed: true, checks: passedLint, totalMs: 95_000 })).toMatchObject({ totalMs: 95_000, bestMs: 90_000, streak: 3 });
		expect(nextRunHistory(previous, { passed: true, checks: passedLint, totalMs: 80_000 })).toMatchObject({ bestMs: 80_000 });
	});

	it("takes an older file's last run as its best", () => {
		expect(nextRunHistory(HISTORY, { passed: true, checks: passedLint, totalMs: 120_000 })).toMatchObject({ bestMs: 100_000, streak: 1 });
	});

	it("ends the streak on a failure and keeps the last good timings, or records nothing with none", () => {
		const failed = { passed: false, checks: passedLint, totalMs: 1 };

		expect(nextRunHistory({ ...HISTORY, streak: 4 }, failed)).toStrictEqual({ ...HISTORY, streak: 0 });
		expect(nextRunHistory(undefined, failed)).toBeUndefined();
	});
});

describe("runRecords", () => {
	const run = { passed: true, checks: [], totalMs: 60_000 };

	it("says nothing about a first run, or a failed one", () => {
		expect(runRecords(undefined, nextRunHistory(undefined, run), run)).toStrictEqual([]);
		expect(runRecords(HISTORY, undefined, { ...run, passed: false })).toStrictEqual([]);
	});

	it("names a new best time instead of the change since last time", () => {
		expect(runRecords(HISTORY, nextRunHistory(HISTORY, run), run)).toStrictEqual(["★ New best time, 1m 00s (was 1m 40s)"]);
	});

	it("compares with last time only when the difference is worth saying", () => {
		const previous = { ...HISTORY, totalMs: 40_000, bestMs: 30_000 };

		expect(runRecords(previous, nextRunHistory(previous, run), run)).toStrictEqual(["20.0s slower than last time"]);
		expect(runRecords({ ...previous, totalMs: 62_000 }, undefined, run)).toStrictEqual([]);
	});

	it("counts green runs in a row from the second one", () => {
		const previous = { ...HISTORY, totalMs: 60_000, bestMs: 50_000, streak: 4 };

		expect(runRecords(previous, nextRunHistory(previous, run), run)).toStrictEqual(["● 5 green runs in a row"]);
		expect(runRecords({ ...previous, streak: 0 }, nextRunHistory({ ...previous, streak: 0 }, run), run)).toStrictEqual([]);
	});
});

describe("estimateRun", () => {
	it("goes by last time's check lengths", () => {
		const estimate = estimateRun([finishCheck(startCheck(lint, 0), true, 15_000), startCheck(test, 15_000)], HISTORY, 55_000);

		expect(estimate).toStrictEqual({ fraction: 0.6, remainingMs: 40_000 });
	});

	it("counts a waiting check in full, and never goes below nothing left", () => {
		expect(estimateRun([lint, test], HISTORY, 0)).toStrictEqual({ fraction: 0, remainingMs: 100_000 });
		expect(estimateRun([finishCheck(startCheck(lint, 0), true, 1), startCheck(test, 0)], HISTORY, 500_000).remainingMs).toBe(0);
	});

	it("gives no time left with no history, or a check the history doesn't know", () => {
		expect(estimateRun([lint], undefined, 0).remainingMs).toBeUndefined();
		expect(estimateRun([lint, waitingCheck("new", "New", undefined)], HISTORY, 0).remainingMs).toBeUndefined();
		expect(estimateRun([lint], { totalMs: 0, checks: { lint: 0 } }, 0).remainingMs).toBeUndefined();
	});

	it("counts checks and packages instead", () => {
		const planned = ["   • Running test in 2 packages", "@workspace/api:test: $ vitest"].reduce((check, line) => applyLine(check, line, 0), startCheck(test, 0));

		expect(estimateRun([finishCheck(startCheck(lint, 0), true, 1), planned], undefined, 0).fraction).toBe(0.75);
		expect(estimateRun([startCheck(lint, 0)], undefined, 0).fraction).toBe(0);
		expect(estimateRun([], undefined, 0).fraction).toBe(0);
	});
});
