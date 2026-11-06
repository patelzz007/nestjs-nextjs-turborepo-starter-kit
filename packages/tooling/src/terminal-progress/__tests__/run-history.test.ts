import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { applyLine, finishCheck, startCheck, waitingCheck } from "../progress.ts";
import { estimateRun, readRunHistory, writeRunHistory } from "../run-history.ts";

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
		writeRunHistory(file, [finishCheck(startCheck(lint, 0), true, 5000)], 6000);

		expect(readRunHistory(file)).toStrictEqual({ totalMs: 6000, checks: { lint: 5000 } });
	});

	it("gives nothing for a missing or damaged file: it's only ever a hint", () => {
		const damaged = path.join(folder, "damaged.json");
		writeFileSync(damaged, '{"totalMs":');

		expect(readRunHistory(path.join(folder, "missing.json"))).toBeUndefined();
		expect(readRunHistory(damaged)).toBeUndefined();
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
