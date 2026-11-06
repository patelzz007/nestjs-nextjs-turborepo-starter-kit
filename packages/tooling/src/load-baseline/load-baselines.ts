/**
 * The rules of the nightly load-test gate (enhancement 3.9): the shape of `budgets/load.json`, the
 * comparison of one finished run against it, the report, and the recalibration that rewrites its p95
 * thresholds from a measured run. Pure (no I/O), so unit-tested without an API or k6.
 *
 * A run reports each scenario step's p95 (apps/load-runner tags every request with its step). Steps are
 * grouped into endpoint groups; a group passes when every one of its steps is at or under the group's
 * p95 threshold, its share of failed requests is at or under its ceiling, and it carried enough requests
 * to mean anything. A step no group names fails the gate (a new step must be put in a group), and so does
 * a group whose steps saw no traffic (the file must describe the real scenarios).
 */
import { z } from "zod";

/** Percent of a share. */
const PERCENT = 100;
/** Recalibrated p95 thresholds are rounded UP to a multiple of this, so a threshold never starts at the exact edge. */
export const P95_ROUNDING_MS = 10;
/** The run statuses that mean the run finished measuring (the API's own pass/fail verdict on its totals). */
const MEASURED_STATUSES = new Set(["PASSED", "FAILED"]);
/** The report's row for the whole run (so no group may take the name). */
export const TOTAL_ROW = "total";

const PositiveIntSchema = z.number().int().positive();
const PercentCeilingSchema = z.number().min(0).max(PERCENT);
const StepNameSchema = z.string().min(1);

/** One endpoint group: the scenario steps it holds and the limits they must stay within. */
const GroupSchema = z
	.object({
		description: z.string().min(1),
		steps: z.array(StepNameSchema).min(1),
		p95Ms: PositiveIntSchema,
		maxErrorPercent: PercentCeilingSchema,
		minRequests: PositiveIntSchema,
	})
	.strict();

/** `budgets/load.json`: the run the nightly job starts, the limits it is held to, and where they came from. */
export const LoadBaselinesSchema = z
	.object({
		/** The load test the job starts (a traffic mix of every scenario; `StartLoadTestSchema` in @workspace/shared). */
		run: z
			.object({
				name: z.string().min(1),
				shape: z.enum(["CONSTANT", "RAMP", "SPIKE", "SOAK"]),
				virtualUsers: PositiveIntSchema,
				requestsPerSecond: PositiveIntSchema,
				durationSeconds: PositiveIntSchema,
				mixWeights: z.record(z.string().min(1), z.number().int().min(0)),
			})
			.strict(),
		/** The whole run's limits (also the run's own pass/fail thresholds in the Operations console). */
		total: z.object({ p95Ms: PositiveIntSchema, maxErrorPercent: PercentCeilingSchema }).strict(),
		groups: z.record(z.string().min(1), GroupSchema),
		/** How the p95 thresholds were set: measured p95 × `factor`, rounded up to {@link P95_ROUNDING_MS}. */
		calibration: z
			.object({
				measuredOn: z.iso.date(),
				source: z.string().min(1),
				factor: z.number().min(1),
				provisional: z.boolean(),
			})
			.strict(),
	})
	.strict()
	.superRefine((baselines, context) => {
		if (Object.hasOwn(baselines.groups, TOTAL_ROW)) {
			context.addIssue({ code: "custom", path: ["groups", TOTAL_ROW], message: `"${TOTAL_ROW}" is the whole run's row, not a group name` });
		}
		const owner = new Map<string, string>();
		for (const [group, { steps }] of Object.entries(baselines.groups)) {
			for (const step of steps) {
				const previous = owner.get(step);
				if (previous !== undefined) {
					context.addIssue({ code: "custom", path: ["groups", group, "steps"], message: `step "${step}" is already in group "${previous}"` });
				}
				owner.set(step, group);
			}
		}
	});

export type LoadBaselines = z.output<typeof LoadBaselinesSchema>;

/** One step of a finished run, as the API's run detail reports it. */
const StepStatSchema = z.object({
	step: z.string(),
	requests: z.number().int().nonnegative(),
	failures: z.number().int().nonnegative(),
	p95Ms: z.number().nonnegative().nullable(),
});

/** The parts of the API's run detail (`GET /admin/operations/load-tests/:runId`) the gate reads. */
export const LoadRunResultsSchema = z.object({
	run: z.object({
		id: z.string().min(1),
		status: z.enum(["QUEUED", "RUNNING", "PASSED", "FAILED", "ABORTED", "ERROR"]),
		totalRequests: z.number().int().nonnegative().nullable(),
		failedRequests: z.number().int().nonnegative().nullable(),
		p95Ms: z.number().nonnegative().nullable(),
		abortReason: z.string().nullable(),
		error: z.string().nullable(),
	}),
	steps: z.array(StepStatSchema),
});

export type LoadRunResults = z.output<typeof LoadRunResultsSchema>;
export type StepStat = z.output<typeof StepStatSchema>;
export type ProblemKind = "p95" | "errors" | "traffic";
export interface Problem {
	kind: ProblemKind;
	message: string;
}
export interface GateRow {
	name: string;
	requests: number;
	failures: number;
	errorPercent: number;
	slowestStep: string | null;
	slowestP95Ms: number | null;
	p95Ms: number;
	maxErrorPercent: number;
	minRequests: number | null;
	problems: Problem[];
}
export interface GateVerdict {
	ok: boolean;
	problems: string[];
	rows: GateRow[];
}

/** The `budgets/load.json` text, validated. */

export function parseLoadBaselines(json: string): LoadBaselines {
	return LoadBaselinesSchema.parse(JSON.parse(json));
}

/** A run's results file (the API's run detail, `data` of its answer), validated. */

export function parseLoadRunResults(json: string): LoadRunResults {
	return LoadRunResultsSchema.parse(JSON.parse(json));
}

/** Failed requests as a percent of all of them (0 when there were none). */

export function errorPercentOf(failures: number, requests: number): number {
	return requests === 0 ? 0 : (failures / requests) * PERCENT;
}

/** The body of `POST /admin/operations/load-tests` for the baselines' run. */

export function startLoadTestBody(baselines: LoadBaselines): {
	name: string;
	target: string;
	scenario: null;
	endpoint: null;
	mixWeights: Record<string, number>;
	shape: "CONSTANT" | "RAMP" | "SOAK" | "SPIKE";
	virtualUsers: number;
	requestsPerSecond: number;
	durationSeconds: number;
	thresholdP95Ms: number;
	thresholdErrorPercent: number;
} {
	const { run, total } = baselines;
	return {
		name: run.name,
		target: "MIX",
		scenario: null,
		endpoint: null,
		mixWeights: run.mixWeights,
		shape: run.shape,
		virtualUsers: run.virtualUsers,
		requestsPerSecond: run.requestsPerSecond,
		durationSeconds: run.durationSeconds,
		thresholdP95Ms: total.p95Ms,
		thresholdErrorPercent: total.maxErrorPercent,
	};
}

/** Decimals of an error percent in a message or the report. */
const PERCENT_DECIMALS = 2;

function errorsProblem(errorPercent: number, ceiling: number): Problem {
	return { kind: "errors", message: `${errorPercent.toFixed(PERCENT_DECIMALS)} % of requests failed, over ${String(ceiling)} %` };
}

/** The slowest step of a set (the one with the highest p95), or null when none measured a p95. */

function slowestOf(steps: readonly StepStat[]): StepStat | null {
	let slowest: StepStat | null = null;
	for (const step of steps) {
		if (step.p95Ms !== null && (slowest?.p95Ms ?? -1) < step.p95Ms) {
			slowest = step;
		}
	}
	return slowest;
}

/** One group's row: its steps' traffic summed, its slowest step, and what it broke. */

function groupRow(name: string, group: z.output<typeof GroupSchema>, byStep: ReadonlyMap<string, StepStat>): GateRow {
	const steps = group.steps.flatMap((step) => {
		const stat = byStep.get(step);
		return stat === undefined ? [] : [stat];
	});
	const requests = steps.reduce((sum, step) => sum + step.requests, 0);
	const failures = steps.reduce((sum, step) => sum + step.failures, 0);
	const errorPercent = errorPercentOf(failures, requests);
	const slowest = slowestOf(steps);
	const problems: Problem[] = [];
	if (requests < group.minRequests) {
		problems.push({ kind: "traffic", message: `${String(requests)} requests, fewer than the ${String(group.minRequests)} it needs to mean anything` });
	}
	for (const step of steps) {
		if (step.p95Ms !== null && step.p95Ms > group.p95Ms) {
			problems.push({ kind: "p95", message: `step "${step.step}" p95 ${String(step.p95Ms)} ms is over ${String(group.p95Ms)} ms` });
		}
	}
	if (errorPercent > group.maxErrorPercent) {
		problems.push(errorsProblem(errorPercent, group.maxErrorPercent));
	}
	return {
		name,
		requests,
		failures,
		errorPercent,
		slowestStep: slowest?.step ?? null,
		slowestP95Ms: slowest?.p95Ms ?? null,
		p95Ms: group.p95Ms,
		maxErrorPercent: group.maxErrorPercent,
		minRequests: group.minRequests,
		problems,
	};
}

/** The whole run's row. */

function totalRow(run: LoadRunResults["run"], total: LoadBaselines["total"]): GateRow {
	const requests = run.totalRequests ?? 0;
	const failures = run.failedRequests ?? 0;
	const errorPercent = errorPercentOf(failures, requests);
	const problems: Problem[] = [];
	if (run.p95Ms !== null && run.p95Ms > total.p95Ms) {
		problems.push({ kind: "p95", message: `p95 ${String(run.p95Ms)} ms is over ${String(total.p95Ms)} ms` });
	}
	if (errorPercent > total.maxErrorPercent) {
		problems.push(errorsProblem(errorPercent, total.maxErrorPercent));
	}
	return {
		name: TOTAL_ROW,
		requests,
		failures,
		errorPercent,
		slowestStep: null,
		slowestP95Ms: run.p95Ms,
		p95Ms: total.p95Ms,
		maxErrorPercent: total.maxErrorPercent,
		minRequests: null,
		problems,
	};
}

/** Why a run cannot be judged at all: it did not finish measuring (aborted, errored, never ran). */

function runProblems(run: LoadRunResults["run"]): string[] {
	if (MEASURED_STATUSES.has(run.status)) {
		return [];
	}
	const why = run.error ?? run.abortReason;
	return [`run ${run.id} ended ${run.status}${why === null ? "" : `: ${why}`}`];
}

/** Every endpoint group and the whole run against the baselines. */

export function compareToLoadBaselines(results: LoadRunResults, baselines: LoadBaselines): GateVerdict {
	const byStep = new Map(results.steps.map((step) => [step.step, step]));
	const grouped = new Set(Object.values(baselines.groups).flatMap((group) => group.steps));
	const problems = [
		...runProblems(results.run),
		...results.steps.filter((step) => !grouped.has(step.step)).map((step) => `step "${step.step}" is in no group of budgets/load.json: add it to one`),
	];
	const rows = [...Object.entries(baselines.groups).map(([name, group]) => groupRow(name, group, byStep)), totalRow(results.run, baselines.total)];
	return { ok: problems.length === 0 && rows.every((row) => row.problems.length === 0), problems, rows };
}

function msCell(ms: number | null): string {
	return ms === null ? "—" : `${String(Math.round(ms))} ms`;
}

/** The verdict as a Markdown table (the job's log and its step summary), problems listed under it. */

export function formatLoadReport(verdict: GateVerdict): string {
	const lines = [
		`### Load-test baselines: ${verdict.ok ? "passed" : "FAILED"}`,
		"",
		"| Group | Requests | Failed | Slowest step | p95 | Limit | Errors | Ceiling | Result |",
		"| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |",
		...verdict.rows.map(
			(row) =>
				`| ${row.name} | ${String(row.requests)} | ${String(row.failures)} | ${row.slowestStep ?? "—"} | ${msCell(row.slowestP95Ms)} | ${msCell(row.p95Ms)} | ${row.errorPercent.toFixed(PERCENT_DECIMALS)} % | ${String(row.maxErrorPercent)} % | ${row.problems.length === 0 ? "ok" : "over"} |`,
		),
	];
	const problems = [...verdict.problems, ...verdict.rows.flatMap((row) => row.problems.map((problem) => `${row.name}: ${problem.message}`))];
	if (problems.length > 0) {
		lines.push("", ...problems.map((problem) => `- ${problem}`));
	}
	return `${lines.join("\n")}\n`;
}

/** A p95 threshold from a measured p95: measured × factor, rounded up to {@link P95_ROUNDING_MS}. */

export function baselineP95(measuredMs: number, factor: number): number {
	if (!Number.isFinite(measuredMs) || measuredMs < 0) {
		throw new Error(`baselineP95 needs a measured p95 of 0 ms or more, got ${String(measuredMs)}`);
	}
	return Math.max(P95_ROUNDING_MS, Math.ceil((measuredMs * factor) / P95_ROUNDING_MS) * P95_ROUNDING_MS);
}

/**
 * The baselines with every p95 threshold recalibrated from a measured run (the error ceilings and the
 * minimum traffic are policy, not measurements, and stay). Refuses a run that broke anything but a p95:
 * a run with errors, too little traffic or unknown steps is not a baseline.
 *   other than the nightly job's own runner (the thresholds still need a CI measurement).
 * @param calibration `provisional`: measured somewhere
 */

export function recalibratedBaselines(
	results: LoadRunResults,
	baselines: LoadBaselines,
	{ measuredOn, source, provisional }: { measuredOn: string; source: string; provisional: boolean },
): LoadBaselines {
	const { factor } = baselines.calibration;
	const verdict = compareToLoadBaselines(results, baselines);
	const blocking = [
		...verdict.problems,
		...verdict.rows.flatMap((row) => row.problems.filter((problem) => problem.kind !== "p95").map((problem) => `${row.name}: ${problem.message}`)),
	];
	if (blocking.length > 0) {
		throw new Error(`This run cannot be a baseline:\n${blocking.map((problem) => `- ${problem}`).join("\n")}`);
	}
	const measuredOf = (name: string): number | null => verdict.rows.find((row) => row.name === name)?.slowestP95Ms ?? null;
	const recalibrate = (name: string, current: number): number => {
		const measured = measuredOf(name);
		return measured === null ? current : baselineP95(measured, factor);
	};
	return LoadBaselinesSchema.parse({
		...baselines,
		total: { ...baselines.total, p95Ms: recalibrate(TOTAL_ROW, baselines.total.p95Ms) },
		groups: Object.fromEntries(Object.entries(baselines.groups).map(([name, group]) => [name, { ...group, p95Ms: recalibrate(name, group.p95Ms) }])),
		calibration: { measuredOn, source, factor, provisional },
	});
}
