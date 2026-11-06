/**
 * The printed table of `pnpm tools dev:timing` (plan §19.1). Pure formatting, so it
 * is unit-tested; the JSON file carries the same numbers for tools.
 */
import { PHASES } from "./dev-timing-plan.ts";

const PHASE_TITLES: ReadonlyMap<string, string> = new Map(Object.values(PHASES).map(({ id, title }) => [id, title]));

const HEADER = ["Phase", "Target", "Median ms", "Runs", "What"];

export function formatSummaryTable(summary: readonly import("./timing.ts").MeasurementSummary[]): string {
	const rows = summary.map(({ phase, target, medianMs, runs }) => [phase, target, String(medianMs), String(runs), PHASE_TITLES.get(phase) ?? ""]);
	const table = [HEADER, ...rows];
	const widths = HEADER.map((_, column) => Math.max(...table.map((row) => (row.at(column) ?? "").length)));
	const format = (row: readonly string[]): string =>
		row
			.map((cell, column) => cell.padEnd(widths.at(column) ?? 0))
			.join("  ")
			.trimEnd();
	const rule = widths.map((width) => "-".repeat(width)).join("  ");
	return [format(HEADER), rule, ...rows.map(format)].join("\n");
}
