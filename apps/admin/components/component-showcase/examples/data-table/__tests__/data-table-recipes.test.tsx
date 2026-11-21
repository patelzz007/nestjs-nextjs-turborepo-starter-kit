// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { UiKitTestProviders } from "@workspace/ui/testing/ui-kit-test-providers";
import type * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	createSync,
	DataTableRecipeAnimatedIcons,
	ICON_MOTIONS,
	INTEGRATIONS,
	SYNC_DURATION_MS,
} from "@/components/component-showcase/examples/data-table/data-table-recipe-animated-icons";
import {
	anomalyOf,
	DataTableRecipeAnomalyInvestigation,
	deviationOf,
	FINANCE,
	OPERATIONS,
} from "@/components/component-showcase/examples/data-table/data-table-recipe-anomaly-investigation";
import {
	CHANGES,
	changePanelTitle,
	changeRowStatus,
	DataTableRecipeChangeReview,
	decide,
	pendingCount,
} from "@/components/component-showcase/examples/data-table/data-table-recipe-change-review";
import { COHORTS, DataTableRecipeCohortRetention, retentionShare } from "@/components/component-showcase/examples/data-table/data-table-recipe-cohort-retention";
import { comparisonColumns, DataTableRecipeComparison, FEATURE_ROWS } from "@/components/component-showcase/examples/data-table/data-table-recipe-comparison";
import {
	DataTableRecipeConditionalFormatting,
	STOCK,
	STOCK_RULES,
	stockLevelOf,
} from "@/components/component-showcase/examples/data-table/data-table-recipe-conditional-formatting";
import {
	DataTableRecipeCrmEmployees,
	EMPLOYEES,
	initialsOf,
	optionsFrom,
	personText,
} from "@/components/component-showcase/examples/data-table/data-table-recipe-crm-employees";
import {
	DataTableRecipeCsvImport,
	guessTarget,
	importRowStatus,
	parseCsv,
	reviewRows,
	SAMPLE_CSV,
} from "@/components/component-showcase/examples/data-table/data-table-recipe-csv-import";
import { DataTableRecipeDeployments, DEPLOYMENTS, formatDuration } from "@/components/component-showcase/examples/data-table/data-table-recipe-deployments";
import {
	compareFoldersFirst,
	DataTableRecipeFileBrowser,
	entriesAt,
	FILE_TREE,
	foldersOnPath,
	formatFileSize,
} from "@/components/component-showcase/examples/data-table/data-table-recipe-file-browser";
import { DataTableRecipeHeatmap, HOURS } from "@/components/component-showcase/examples/data-table/data-table-recipe-heatmap";
import {
	ALLOCATIONS,
	availableOf,
	commitmentValidator,
	DataTableRecipeInventoryAllocation,
	parseUnits,
	withAllocationValue,
} from "@/components/component-showcase/examples/data-table/data-table-recipe-inventory-allocation";
import {
	advanceJobs,
	DataTableRecipeJobQueue,
	INITIAL_JOBS,
	isJobFailed,
	JOB_TICK_MS,
	retryJob,
} from "@/components/component-showcase/examples/data-table/data-table-recipe-job-queue";
import { DataTableRecipeKpi, KPIS, lastTwo, moveTone } from "@/components/component-showcase/examples/data-table/data-table-recipe-kpi";
import {
	DataTableRecipeLiveStatus,
	healthFor,
	INITIAL_PROBES,
	nextProbes,
	PROBE_INTERVAL_MS,
} from "@/components/component-showcase/examples/data-table/data-table-recipe-live-status";
import { DataTableRecipeLogs, LOGS, logPanelTitle } from "@/components/component-showcase/examples/data-table/data-table-recipe-logs";
import { DataTableRecipePermissionsMatrix, PERMISSIONS, togglePermission } from "@/components/component-showcase/examples/data-table/data-table-recipe-permissions-matrix";
import { DataTableRecipeProductionDashboard, LINE_SHIFTS, progressShare } from "@/components/component-showcase/examples/data-table/data-table-recipe-production-dashboard";
import {
	applyRosterChanges,
	coverageOn,
	DataTableRecipeScheduleMatrix,
	parseShift,
	ROSTER,
} from "@/components/component-showcase/examples/data-table/data-table-recipe-schedule-matrix";
import { DataTableRecipeTreeVariants, ORGANISATION, TREE_VARIANTS } from "@/components/component-showcase/examples/data-table/data-table-recipe-tree-variants";
import { installJsdomUiShims } from "@/testing/jsdom-ui-shims";

afterEach((): void => {
	cleanup();
	vi.useRealTimers();
});

/** Every recipe, with a piece of text its first screen shows. */
const RECIPES: readonly (readonly [string, React.ComponentType, string])[] = [
	["animated icons", DataTableRecipeAnimatedIcons, "Team chat"],
	["anomaly investigation", DataTableRecipeAnomalyInvestigation, "Queue depth"],
	["change review", DataTableRecipeChangeReview, "plans.team.price"],
	["cohort retention", DataTableRecipeCohortRetention, "Jun"],
	["comparison", DataTableRecipeComparison, "Single sign-on"],
	["conditional formatting", DataTableRecipeConditionalFormatting, "Staples 26/6"],
	["CRM employees", DataTableRecipeCrmEmployees, "Aisha Rahman"],
	["CSV import", DataTableRecipeCsvImport, "Review import"],
	["deployments", DataTableRecipeDeployments, "Status"],
	["file browser", DataTableRecipeFileBrowser, "Contracts"],
	["heatmap", DataTableRecipeHeatmap, "Mon"],
	["inventory allocation", DataTableRecipeInventoryAllocation, "CHAIR-OAK"],
	["job queue", DataTableRecipeJobQueue, "Rebuild search index"],
	["KPIs", DataTableRecipeKpi, "Weekly revenue"],
	["live status", DataTableRecipeLiveStatus, "Public API"],
	["logs", DataTableRecipeLogs, "Level"],
	["permissions matrix", DataTableRecipePermissionsMatrix, "Refund orders"],
	["production dashboard", DataTableRecipeProductionDashboard, "Bottling"],
	["schedule matrix", DataTableRecipeScheduleMatrix, "Aisha Rahman"],
	["tree variants", DataTableRecipeTreeVariants, "Outline"],
];

describe("DataTable recipes render", () => {
	installJsdomUiShims();

	it.each(RECIPES)("renders the %s recipe", (_name: string, Recipe: React.ComponentType, text: string): void => {
		render(<Recipe />, { wrapper: UiKitTestProviders });
		expect(screen.getAllByText(text, { exact: false }).length).toBeGreaterThan(0);
	});
});

describe("recipe helpers", () => {
	it("anomaly: places an observation against its band and measures how far out it is", () => {
		const [latency, errors, queue] = OPERATIONS;
		expect(latency === undefined ? null : anomalyOf(latency)).toBe("above");
		expect(errors === undefined ? null : anomalyOf(errors)).toBe("normal");
		expect(queue === undefined ? null : anomalyOf(queue)).toBe("below");
		expect(latency === undefined ? null : deviationOf(latency)).toBeCloseTo((410 - 260) / (260 - 180));
		expect(errors === undefined ? null : deviationOf(errors)).toBe(0);
		expect(queue === undefined ? null : deviationOf(queue)).toBeCloseTo((40 - 18) / (120 - 40));
		expect(FINANCE.map(anomalyOf)).toEqual(["above", "normal", "normal", "below"]);
	});

	it("change review: marks rows by kind, records decisions and counts what is pending", () => {
		expect(CHANGES.map(changeRowStatus)).toEqual(["dirty", "dirty", "new", "deleted", "dirty"]);
		const decided = decide(CHANGES, "c-1", "approved");
		expect(decided.find((change) => change.id === "c-1")?.decision).toBe("approved");
		expect(pendingCount(CHANGES)).toBe(CHANGES.length);
		expect(pendingCount(decided)).toBe(CHANGES.length - 1);
		const [first] = CHANGES;
		expect(first === undefined ? null : changePanelTitle(first)).toBe("plans.team.price");
	});

	it("cohort retention: a share for every period reached and null after", () => {
		const [first] = COHORTS;
		const last = COHORTS.at(-1);
		expect(first === undefined ? null : retentionShare(first, 0)).toBeGreaterThan(0);
		expect(first === undefined ? null : retentionShare(first, 0)).toBeLessThanOrEqual(1);
		expect(last === undefined ? undefined : retentionShare(last, 1)).toBeNull();
	});

	it("comparison: one column per chosen plan after the feature column, the highlighted plan tinted", () => {
		const columns = comparisonColumns(["team", "business"], "business");
		expect(columns.map((column) => column.id ?? "feature")).toEqual(["feature", "team", "business"]);
		expect(columns.at(2)?.meta?.cellClassName).toContain("bg-primary/8");
		expect(columns.at(1)?.meta?.cellClassName).not.toContain("bg-primary/8");
		expect(FEATURE_ROWS.length).toBeGreaterThan(0);
	});

	it("conditional formatting: the first matching rule decides each level", () => {
		expect(STOCK.map(stockLevelOf)).toEqual(["healthy", "reorder", "out", "low", "healthy", "low"]);
		expect(STOCK_RULES.at(-1)?.level).toBe("healthy");
	});

	it("CRM: initials, sorted unique options and the searchable person text", () => {
		expect(initialsOf("Aisha Rahman")).toBe("AR");
		expect(initialsOf("  chen  ")).toBe("C");
		expect(initialsOf("Mary Ann Smith")).toBe("MA");
		expect(optionsFrom(["Sales", "Design", "Sales"])).toEqual([
			{ value: "Design", label: "Design" },
			{ value: "Sales", label: "Sales" },
		]);
		const [first] = EMPLOYEES;
		expect(first === undefined ? null : personText(first)).toBe("Aisha Rahman aisha@example.com");
	});

	it("CSV: parses quotes, doubled quotes, CRLF and blank lines; guesses targets; reviews each line", () => {
		expect(parseCsv('a,"b, c","say ""hi"""\r\n\r\n1,2,3\n')).toEqual([
			["a", "b, c", 'say "hi"'],
			["1", "2", "3"],
		]);
		expect(guessTarget(" Email ")).toBe("email");
		expect(guessTarget("Notes")).toBe("ignore");
		const [headings = [], ...lines] = parseCsv(SAMPLE_CSV);
		const rows = reviewRows(lines, headings.map(guessTarget));
		expect(rows.map((row) => row.problem)).toEqual([null, null, "Email is not valid", "Name is missing", "Plan must be starter, team or business"]);
		expect(rows.at(0)?.line).toBe(2);
		expect(rows.map(importRowStatus)).toEqual(["new", "new", "deleted", "deleted", "deleted"]);
	});

	it("deployments: durations read as minutes and seconds, a dash while running", () => {
		expect(formatDuration(94)).toBe("1m 34s");
		expect(formatDuration(41)).toBe("41s");
		expect(formatDuration(undefined)).toBe("–");
		expect(DEPLOYMENTS.length).toBeGreaterThan(0);
	});

	it("file browser: sizes, walking a path, the breadcrumb and folders first both ways", () => {
		const [contracts, brand, readme, photo, archive] = FILE_TREE;
		expect(contracts === undefined ? null : formatFileSize(contracts)).toBe("–");
		expect(readme === undefined ? null : formatFileSize(readme)).toBe("3.0 KB");
		expect(archive === undefined ? null : formatFileSize(archive)).toBe("68.1 MB");
		expect(formatFileSize({ id: "x", name: "x", kind: "other", sizeBytes: 12, modifiedEpochMs: 0 })).toBe("12 B");
		expect(entriesAt(FILE_TREE, []).length).toBe(FILE_TREE.length);
		expect(entriesAt(FILE_TREE, ["contracts"]).map((entry) => entry.id)).toEqual(["contracts-acme", "contracts-2025"]);
		expect(entriesAt(FILE_TREE, ["nope"])).toEqual([]);
		expect(foldersOnPath(FILE_TREE, ["contracts", "contracts-2025", "missing"]).map((folder) => folder.id)).toEqual(["contracts", "contracts-2025"]);
		if (brand === undefined || photo === undefined || readme === undefined) {
			throw new Error("the sample tree has five entries");
		}
		expect(compareFoldersFirst(brand, photo, false)).toBeLessThan(0);
		expect(compareFoldersFirst(brand, photo, true)).toBeGreaterThan(0);
		expect(compareFoldersFirst(readme, photo, false)).toBeLessThan(0);
	});

	it("heatmap: a row of figures for every hour", () => {
		expect(HOURS.length).toBeGreaterThan(0);
	});

	it("inventory: free units, whole-unit parsing, refusing over-promises and writing valid figures only", () => {
		const [first] = ALLOCATIONS;
		if (first === undefined) {
			throw new Error("the sample has allocations");
		}
		expect(availableOf(first)).toBe(120 - 84 - 10);
		expect(parseUnits("12")).toBe(12);
		expect(parseUnits(" ")).toBeUndefined();
		expect(parseUnits("1.5")).toBeUndefined();
		expect(parseUnits("-3")).toBeUndefined();
		expect(commitmentValidator("allocated")(111, first)).toBe("At most 110 can be allocated here");
		expect(commitmentValidator("allocated")(110, first)).toBeUndefined();
		expect(commitmentValidator("reserved")(37, first)).toBe("At most 36 can be reserved here");
		expect(commitmentValidator("reserved")("text", first)).toBeUndefined();
		expect(withAllocationValue(first, "allocated", 90).allocated).toBe(90);
		expect(withAllocationValue(first, "allocated", -1)).toBe(first);
	});

	it("job queue: running jobs advance and finish, the next queued one starts when none runs, and failed jobs retry", () => {
		const ticked = advanceJobs(INITIAL_JOBS);
		expect(ticked.find((job) => job.id === "j-1")?.progress).toBe(40);
		expect(ticked.find((job) => job.id === "j-3")?.state).toBe("queued");
		const idle = advanceJobs(INITIAL_JOBS.map((job) => (job.state === "running" ? { ...job, state: "done" } : job)));
		expect(idle.find((job) => job.id === "j-3")?.state).toBe("running");
		const [running] = INITIAL_JOBS;
		if (running === undefined) {
			throw new Error("the sample has jobs");
		}
		expect(advanceJobs([{ ...running, progress: 98 }]).at(0)?.state).toBe("done");
		const retried = retryJob(INITIAL_JOBS, "j-4");
		expect(retried.find((job) => job.id === "j-4")).toMatchObject({ state: "queued", progress: 0 });
		expect(retryJob(INITIAL_JOBS, "j-1")).toEqual(INITIAL_JOBS);
		expect(INITIAL_JOBS.filter(isJobFailed).map((job) => job.id)).toEqual(["j-4"]);
		expect(JOB_TICK_MS).toBeGreaterThan(0);
	});

	it("KPIs: the last two weeks and whether the move is good news for that metric", () => {
		const [revenue, , churn, tickets] = KPIS;
		if (revenue === undefined || churn === undefined || tickets === undefined) {
			throw new Error("the sample has four metrics");
		}
		expect(lastTwo(revenue)).toEqual({ previous: 51200, current: 53400 });
		expect(moveTone(revenue)).toBe("good");
		expect(moveTone(churn)).toBe("good");
		expect(moveTone(tickets)).toBe("bad");
		expect(moveTone({ ...revenue, weeks: [5, 5] })).toBe("neutral");
		expect(lastTwo({ ...revenue, weeks: [] })).toEqual({ previous: 0, current: 0 });
	});

	it("live status: health by latency, and each tick a new, bounded latency and one more check", () => {
		expect(healthFor(100)).toBe("up");
		expect(healthFor(300)).toBe("degraded");
		expect(healthFor(500)).toBe("down");
		const next = nextProbes(INITIAL_PROBES, 1);
		expect(next).not.toBe(INITIAL_PROBES);
		for (const probe of next) {
			expect(probe.checks).toBe(1);
			expect(probe.latencyMs).toBeGreaterThanOrEqual(30);
			expect(probe.latencyMs).toBeLessThanOrEqual(520);
			expect(probe.health).toBe(healthFor(probe.latencyMs));
		}
		expect(nextProbes(INITIAL_PROBES, 1)).toEqual(next);
		expect(PROBE_INTERVAL_MS).toBeGreaterThan(0);
	});

	it("logs: the panel heading names the service and the level", () => {
		const [first] = LOGS;
		expect(first === undefined ? null : logPanelTitle(first)).toBe(`${first?.service ?? ""} · ${first?.level ?? ""}`);
	});

	it("permissions: grants and withdraws one role on one permission, leaving the rest", () => {
		const granted = togglePermission(PERMISSIONS, "billing.manage", "admin", true);
		expect(granted.find((row) => row.id === "billing.manage")?.granted.has("admin")).toBe(true);
		const withdrawn = togglePermission(granted, "billing.manage", "admin", false);
		expect(withdrawn.find((row) => row.id === "billing.manage")?.granted.has("admin")).toBe(false);
		expect(granted.find((row) => row.id === "orders.read")).toBe(PERMISSIONS.at(0));
	});

	it("production: progress against target, capped at done", () => {
		expect(LINE_SHIFTS.map((shift) => Number(progressShare(shift).toFixed(3)))).toEqual([0.945, 0.683, 1, 0.517]);
		const [first] = LINE_SHIFTS;
		expect(first === undefined ? null : progressShare({ ...first, target: 0 })).toBe(0);
	});

	it("schedule: parses shift codes, counts cover per day and applies only valid writes", () => {
		expect(parseShift(" off ")).toBe("OFF");
		expect(parseShift("d")).toBe("D");
		expect(parseShift("X")).toBeUndefined();
		expect(coverageOn(ROSTER, 0)).toEqual({ D: 1, E: 1, N: 1, OFF: 1 });
		const [aisha] = ROSTER;
		if (aisha === undefined) {
			throw new Error("the roster has people");
		}
		const next = applyRosterChanges(ROSTER, {
			source: "paste",
			rejected: [],
			changes: [
				{ rowId: "s-1", columnId: "Mon", row: aisha, previousValue: "D", value: "N" },
				{ rowId: "s-1", columnId: "Tue", row: aisha, previousValue: "D", value: "X" },
			],
		});
		expect(next.at(0)?.shifts.slice(0, 2)).toEqual(["N", "D"]);
		expect(next.at(1)).toBe(ROSTER.at(1));
	});

	it("tree variants: each variant is only a different tree, layout and selection over the same organisation", () => {
		expect(TREE_VARIANTS.compact.tree.defaultExpanded).toBe(false);
		expect(TREE_VARIANTS.selectable.selection?.cascade).toBe(true);
		expect(TREE_VARIANTS.outline.selection).toBeUndefined();
		expect(ORGANISATION.length).toBeGreaterThan(0);
	});

	it("animated icons: a motion per action; billing fails its first sync and succeeds on retry", async (): Promise<void> => {
		vi.useFakeTimers();
		expect(Object.keys(ICON_MOTIONS)).toEqual(["sync", "send", "delete"]);
		const sync = createSync();
		const billing = INTEGRATIONS.find((integration) => integration.id === "billing");
		const chat = INTEGRATIONS.find((integration) => integration.id === "chat");
		if (billing === undefined || chat === undefined) {
			throw new Error("the sample has billing and chat");
		}
		const first = sync(billing);
		const firstOutcome = first.then(
			(): string => "resolved",
			(): string => "rejected",
		);
		await act(async (): Promise<void> => {
			await vi.advanceTimersByTimeAsync(SYNC_DURATION_MS);
		});
		await expect(firstOutcome).resolves.toBe("rejected");
		const retry = sync(billing);
		const other = sync(chat);
		await act(async (): Promise<void> => {
			await vi.advanceTimersByTimeAsync(SYNC_DURATION_MS);
		});
		await expect(retry).resolves.toBeUndefined();
		await expect(other).resolves.toBeUndefined();
	});
});
