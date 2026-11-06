import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
	P95_ROUNDING_MS,
	baselineP95,
	compareToLoadBaselines,
	errorPercentOf,
	formatLoadReport,
	parseLoadBaselines,
	parseLoadRunResults,
	recalibratedBaselines,
	startLoadTestBody,
} from "../load-baselines.ts";

function baselines(): import("../load-baselines.ts").LoadBaselines {
	return {
		run: { name: "Nightly", shape: "CONSTANT", virtualUsers: 20, requestsPerSecond: 5, durationSeconds: 120, mixWeights: { "sign-in": 1, "browse-marketplace": 3 } },
		total: { p95Ms: 500, maxErrorPercent: 1 },
		groups: {
			auth: { description: "Signing in", steps: ["login", "session"], p95Ms: 400, maxErrorPercent: 1, minRequests: 10 },
			marketplace: { description: "The marketplace", steps: ["marketplace", "reward"], p95Ms: 300, maxErrorPercent: 1, minRequests: 10 },
		},
		calibration: { measuredOn: "2026-11-04", source: "test", factor: 2, provisional: false },
	};
}

function results(
	run: Partial<import("../load-baselines.ts").LoadRunResults["run"]> = {},
	steps?: import("../load-baselines.ts").StepStat[],
): import("../load-baselines.ts").LoadRunResults {
	return {
		run: { id: "run-1", status: "PASSED", totalRequests: 100, failedRequests: 0, p95Ms: 250, abortReason: null, error: null, ...run },
		steps: steps ?? [
			{ step: "login", requests: 20, failures: 0, p95Ms: 350 },
			{ step: "session", requests: 20, failures: 0, p95Ms: 40 },
			{ step: "marketplace", requests: 40, failures: 0, p95Ms: 120 },
			{ step: "reward", requests: 20, failures: 0, p95Ms: 90 },
		],
	};
}

describe("budgets/load.json (enhancement 3.9)", () => {
	it("is valid, every step in exactly one group", () => {
		const file = readFileSync(path.resolve(import.meta.dirname, "../../../../../budgets/load.json"), "utf8");
		const parsed = parseLoadBaselines(file);
		const steps = Object.values(parsed.groups).flatMap((group) => group.steps);
		expect(new Set(steps).size).toBe(steps.length);
	});

	it("refuses a step in two groups, a group named after the total row, unknown keys and a factor below 1", () => {
		const twice = baselines();
		twice.groups.marketplace?.steps.push("login");
		expect(() => parseLoadBaselines(JSON.stringify(twice))).toThrow(/is already in group/u);

		const total = baselines();
		total.groups.total = { description: "x", p95Ms: 1, maxErrorPercent: 1, minRequests: 1, ...total.groups.auth, steps: ["other"] };
		expect(() => parseLoadBaselines(JSON.stringify(total))).toThrow(/whole run's row/u);

		expect(() => parseLoadBaselines(JSON.stringify({ ...baselines(), extra: true }))).toThrow();
		const factor = baselines();
		factor.calibration.factor = 0.5;
		expect(() => parseLoadBaselines(JSON.stringify(factor))).toThrow();
	});
});

describe("startLoadTestBody", () => {
	it("starts a traffic mix of the baselines' run, the total limits as the run's own thresholds", () => {
		expect(startLoadTestBody(baselines())).toEqual({
			name: "Nightly",
			target: "MIX",
			scenario: null,
			endpoint: null,
			mixWeights: { "sign-in": 1, "browse-marketplace": 3 },
			shape: "CONSTANT",
			virtualUsers: 20,
			requestsPerSecond: 5,
			durationSeconds: 120,
			thresholdP95Ms: 500,
			thresholdErrorPercent: 1,
		});
	});
});

describe("errorPercentOf", () => {
	it("is the failed share in percent, and 0 without requests", () => {
		expect(errorPercentOf(1, 200)).toBe(0.5);
		expect(errorPercentOf(0, 0)).toBe(0);
	});
});

describe("compareToLoadBaselines", () => {
	it("passes a run inside every limit, reporting each group's slowest step", () => {
		const verdict = compareToLoadBaselines(results(), baselines());
		expect(verdict.ok).toBe(true);
		expect(verdict.problems).toEqual([]);
		expect(verdict.rows.map((row) => [row.name, row.requests, row.slowestStep, row.slowestP95Ms])).toEqual([
			["auth", 40, "login", 350],
			["marketplace", 60, "marketplace", 120],
			["total", 100, null, 250],
		]);
	});

	it("fails a group when any of its steps is over the group's p95", () => {
		const verdict = compareToLoadBaselines(
			results({}, [...results().steps.filter((step) => step.step !== "reward"), { step: "reward", requests: 20, failures: 0, p95Ms: 301 }]),
			baselines(),
		);
		expect(verdict.ok).toBe(false);
		expect(verdict.rows.find((row) => row.name === "marketplace")?.problems).toEqual([{ kind: "p95", message: 'step "reward" p95 301 ms is over 300 ms' }]);
	});

	it("fails a group whose summed failures are over its ceiling, and one with too little traffic", () => {
		const steps = [
			{ step: "login", requests: 4, failures: 1, p95Ms: 100 },
			{ step: "marketplace", requests: 40, failures: 0, p95Ms: 100 },
		];
		const verdict = compareToLoadBaselines(results({}, steps), baselines());
		expect(verdict.rows.find((row) => row.name === "auth")?.problems.map((problem) => problem.kind)).toEqual(["traffic", "errors"]);
		expect(verdict.ok).toBe(false);
	});

	it("fails the whole run over its own p95 or error ceiling", () => {
		const verdict = compareToLoadBaselines(results({ p95Ms: 600, failedRequests: 2 }), baselines());
		expect(verdict.rows.find((row) => row.name === "total")?.problems.map((problem) => problem.message)).toEqual([
			"p95 600 ms is over 500 ms",
			"2.00 % of requests failed, over 1 %",
		]);
	});

	it("fails a step no group names, and a run that did not finish measuring", () => {
		const verdict = compareToLoadBaselines(
			results({ status: "ERROR", error: "k6 exited with code 99" }, [...results().steps, { step: "new-step", requests: 5, failures: 0, p95Ms: 10 }]),
			baselines(),
		);
		expect(verdict.ok).toBe(false);
		expect(verdict.problems).toEqual(["run run-1 ended ERROR: k6 exited with code 99", 'step "new-step" is in no group of budgets/load.json: add it to one']);
		expect(compareToLoadBaselines(results({ status: "ABORTED", abortReason: null }), baselines()).problems).toEqual(["run run-1 ended ABORTED"]);
	});

	it("treats a run with no totals as no traffic, and a step without a p95 as not slow", () => {
		const verdict = compareToLoadBaselines(
			results({ totalRequests: null, failedRequests: null, p95Ms: null }, [
				{ step: "login", requests: 20, failures: 0, p95Ms: null },
				{ step: "marketplace", requests: 20, failures: 0, p95Ms: 100 },
			]),
			baselines(),
		);
		const auth = verdict.rows.find((row) => row.name === "auth");
		expect(auth?.slowestStep).toBeNull();
		expect(auth?.problems).toEqual([]);
		expect(verdict.rows.find((row) => row.name === "total")).toMatchObject({ requests: 0, failures: 0, problems: [] });
	});
});

describe("formatLoadReport", () => {
	it("renders a Markdown table, and the problems under it when it failed", () => {
		const passed = formatLoadReport(compareToLoadBaselines(results(), baselines()));
		expect(passed).toContain("### Load-test baselines: passed");
		expect(passed).toContain("| auth | 40 | 0 | login | 350 ms | 400 ms | 0.00 % | 1 % | ok |");
		expect(passed).not.toContain("\n- ");

		const failed = formatLoadReport(compareToLoadBaselines(results({ status: "ERROR", p95Ms: null }), baselines()));
		expect(failed).toContain("### Load-test baselines: FAILED");
		expect(failed).toContain("| total | 100 | 0 | — | — | 500 ms |");
		expect(failed).toContain("- run run-1 ended ERROR");

		const slow = formatLoadReport(compareToLoadBaselines(results({ p95Ms: 600 }), baselines()));
		expect(slow).toContain("- total: p95 600 ms is over 500 ms");
	});
});

describe("parseLoadRunResults", () => {
	it("reads the API's run detail, ignoring the fields the gate does not use", () => {
		const detail = { ...results(), points: [], servers: [], run: { ...results().run, name: "Nightly", p50Ms: 20 } };
		expect(parseLoadRunResults(JSON.stringify(detail)).run.status).toBe("PASSED");
		expect(() => parseLoadRunResults(JSON.stringify({ run: { id: "x" }, steps: [] }))).toThrow();
	});
});

describe("baselineP95", () => {
	it("is measured × factor rounded up to the rounding step, never below one step", () => {
		expect(baselineP95(101, 2)).toBe(210);
		expect(baselineP95(100, 2)).toBe(200);
		expect(baselineP95(0, 2)).toBe(P95_ROUNDING_MS);
		expect(() => baselineP95(-1, 2)).toThrow(/0 ms or more/u);
		expect(() => baselineP95(Number.NaN, 2)).toThrow();
	});
});

describe("recalibratedBaselines", () => {
	it("rewrites every p95 from the run and records where it was measured, keeping the policy limits", () => {
		const updated = recalibratedBaselines(results({ p95Ms: 260 }), baselines(), { measuredOn: "2026-11-05", source: "nightly run 42", provisional: false });
		expect(updated.total).toEqual({ p95Ms: 520, maxErrorPercent: 1 });
		expect(updated.groups.auth).toMatchObject({ p95Ms: 700, maxErrorPercent: 1, minRequests: 10 });
		expect(updated.groups.marketplace?.p95Ms).toBe(240);
		expect(updated.calibration).toEqual({ measuredOn: "2026-11-05", source: "nightly run 42", factor: 2, provisional: false });
	});

	it("recalibrates from a run that was only too slow, and keeps a threshold the run measured nothing for", () => {
		const slow = results({ p95Ms: null }, [
			{ step: "login", requests: 20, failures: 0, p95Ms: 900 },
			{ step: "marketplace", requests: 20, failures: 0, p95Ms: null },
		]);
		const updated = recalibratedBaselines(slow, baselines(), { measuredOn: "2026-11-05", source: "laptop", provisional: true });
		expect(updated.groups.auth?.p95Ms).toBe(1800);
		expect(updated.groups.marketplace?.p95Ms).toBe(300);
		expect(updated.total.p95Ms).toBe(500);
		expect(updated.calibration.provisional).toBe(true);
	});

	it("refuses a run with errors, too little traffic, unknown steps or no measurements", () => {
		const failing = results({ failedRequests: 50 }, [{ step: "login", requests: 4, failures: 4, p95Ms: 10 }]);
		expect(() => recalibratedBaselines(failing, baselines(), { measuredOn: "2026-11-05", source: "x", provisional: false })).toThrow(/cannot be a baseline[\s\S]*auth: /u);
		expect(() => recalibratedBaselines(results({ status: "ERROR" }), baselines(), { measuredOn: "2026-11-05", source: "x", provisional: false })).toThrow(/ended ERROR/u);
	});
});
