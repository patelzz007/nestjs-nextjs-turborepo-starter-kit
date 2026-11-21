"use client";

import * as React from "react";
import { z } from "zod";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { DataTable, type DataTableColumns, type DataTableHeading, type DataTableRowStatus } from "@workspace/ui/components/data-table";
import { Label } from "@workspace/ui/components/label";
import { NativeSelect, NativeSelectOption } from "@workspace/ui/components/native-select";
import { Textarea } from "@workspace/ui/components/textarea";

// ── Parsing ────────────────────────────────────────────────────────────────

/**
 * Splits CSV text into rows of fields. Handles quoted fields, commas and doubled quotes inside them, and CRLF or LF
 * line ends. Blank lines are skipped.
 */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let isQuoted = false;
	let previous = "";
	const endRow = (): void => {
		row.push(field);
		if (row.some((cell) => cell.trim() !== "")) {
			rows.push(row);
		}
		row = [];
		field = "";
	};
	for (const char of text) {
		if (isQuoted) {
			if (char === '"') {
				isQuoted = false;
			} else {
				field += char;
			}
		} else if (char === '"') {
			// A quote right after a closing quote is an escaped quote inside the field.
			if (previous === '"') {
				field += '"';
			}
			isQuoted = true;
		} else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\n") {
			endRow();
		} else if (char !== "\r") {
			field += char;
		}
		previous = char;
	}
	endRow();
	return rows;
}

// ── Mapping ────────────────────────────────────────────────────────────────

const targetSchema = z.enum(["name", "email", "plan", "ignore"]);
export type ImportTarget = z.output<typeof targetSchema>;

const TARGET_LABELS: Readonly<Record<ImportTarget, string>> = { name: "Name", email: "Email", plan: "Plan", ignore: "Skip column" };

/** Guesses a target from a CSV heading, so the common names map themselves. */
export function guessTarget(heading: string): ImportTarget {
	const guessed = targetSchema.safeParse(heading.trim().toLowerCase());
	return guessed.success ? guessed.data : "ignore";
}

/** One CSV line after mapping: its raw cells, and the problem that stops it importing, if any. */
export interface ImportRow {
	readonly id: string;
	readonly line: number;
	readonly cells: readonly string[];
	readonly problem: string | null;
}

const customerSchema = z.object({
	name: z.string().trim().min(1, "Name is missing"),
	email: z.email("Email is not valid"),
	plan: z.enum(["starter", "team", "business"], "Plan must be starter, team or business"),
});

/** The first line of a CSV is its headings; the rest are checked against the mapping. */
const FIRST_DATA_LINE = 2;

/** Checks each line against the mapping and the customer rules, keeping the first problem it finds. */
export function reviewRows(lines: readonly (readonly string[])[], mapping: readonly ImportTarget[]): ImportRow[] {
	return lines.map((cells, index): ImportRow => {
		const record: Record<string, string> = {};
		mapping.forEach((target, column) => {
			if (target !== "ignore") {
				record[target] = (cells.at(column) ?? "").trim();
			}
		});
		const checked = customerSchema.safeParse(record);
		const [issue] = checked.success ? [] : checked.error.issues;
		return { id: `line-${String(index)}`, line: index + FIRST_DATA_LINE, cells, problem: issue === undefined ? null : issue.message };
	});
}

/** A line that will import is marked new; one that will be skipped is struck through. */
export function importRowStatus(row: ImportRow): DataTableRowStatus {
	return row.problem === null ? "new" : "deleted";
}

export const SAMPLE_CSV = [
	"Name,Email,Plan,Notes",
	"Aisha Rahman,aisha@example.com,team,Renewal in March",
	'"Ortega, Ben",ben@example.com,business,"Asked for ""priority"" support"',
	"Chen Wei,chen-at-example.com,starter,",
	",divya@example.com,team,No name given",
	"Elena Petrova,elena@example.com,enterprise,",
].join("\n");

// ── Component ──────────────────────────────────────────────────────────────

interface MappingSelectProps {
	readonly column: number;
	readonly heading: string;
	readonly target: ImportTarget;
	readonly onChange: (column: number, target: ImportTarget) => void;
}

/** The select in a column's header that says which field the column fills. */
function MappingSelect({ column, heading, target, onChange }: MappingSelectProps): React.JSX.Element {
	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLSelectElement>): void => {
			const next = targetSchema.safeParse(event.currentTarget.value);
			if (next.success) {
				onChange(column, next.data);
			}
		},
		[column, onChange],
	);
	return (
		<div className="grid gap-1 py-1" data-cell-interactive="">
			<span className="text-xs text-muted-foreground">{heading}</span>
			<NativeSelect size="sm" value={target} onChange={handleChange} aria-label={`Field for column ${heading}`}>
				{targetSchema.options.map((option) => (
					<NativeSelectOption key={option} value={option}>
						{TARGET_LABELS[option]}
					</NativeSelectOption>
				))}
			</NativeSelect>
		</div>
	);
}

function getImportRowId(row: ImportRow): string {
	return row.id;
}

/**
 * Recipe: importing a CSV. Paste text, then map each column to a field with the select in its header (common
 * headings map themselves). Every line is checked: lines that will import are marked new, lines that will be skipped
 * are struck through with the reason. Parsing and checking live in the recipe; the table only shows the result.
 */
export function DataTableRecipeCsvImport(): React.JSX.Element {
	const textId = React.useId();
	const [text, setText] = React.useState(SAMPLE_CSV);
	// Split once per text, so `headings` and `lines` keep their identity between renders and the memos below hold.
	const { headings, lines } = React.useMemo((): { readonly headings: readonly string[]; readonly lines: readonly string[][] } => {
		const [first = [], ...rest] = parseCsv(text);
		return { headings: first, lines: rest };
	}, [text]);
	const [mappingOverrides, setMappingOverrides] = React.useState<Readonly<Record<number, ImportTarget>>>({});
	const mapping = React.useMemo((): ImportTarget[] => headings.map((heading, column) => mappingOverrides[column] ?? guessTarget(heading)), [headings, mappingOverrides]);
	const rows = React.useMemo((): ImportRow[] => reviewRows(lines, mapping), [lines, mapping]);
	const readyCount = rows.filter((row) => row.problem === null).length;

	const handleTextChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>): void => {
		setText(event.currentTarget.value);
		setMappingOverrides({});
	}, []);

	const handleMappingChange = React.useCallback((column: number, target: ImportTarget): void => {
		setMappingOverrides((current) => ({ ...current, [column]: target }));
	}, []);

	const columns = React.useMemo(
		(): DataTableColumns<ImportRow> => [
			{
				accessorKey: "line",
				header: "Line",
				size: 70,
				meta: { cellClassName: "text-end tabular-nums text-muted-foreground", headerClassName: "text-end [&>div]:justify-end" },
			},
			...headings.map((heading, column): DataTableColumns<ImportRow>[number] => ({
				id: `column-${String(column)}`,
				size: 170,
				enableSorting: false,
				header: (): React.JSX.Element => <MappingSelect column={column} heading={heading} target={mapping.at(column) ?? "ignore"} onChange={handleMappingChange} />,
				accessorFn: (row: ImportRow): string => row.cells.at(column) ?? "",
			})),
			{
				id: "result",
				header: "Result",
				size: 240,
				enableSorting: false,
				cell: ({ row }): React.JSX.Element =>
					row.original.problem === null ? <Badge variant="success-light">Ready</Badge> : <Badge variant="destructive-light">{row.original.problem}</Badge>,
			},
		],
		[headings, mapping, handleMappingChange],
	);

	const heading = React.useMemo(
		(): DataTableHeading => ({
			title: "Review import",
			description: `${String(readyCount)} of ${String(rows.length)} lines will import.`,
			actions: (
				<Button size="sm" disabled={readyCount === 0}>
					Import {readyCount}
				</Button>
			),
		}),
		[readyCount, rows.length],
	);

	return (
		<div className="grid gap-4">
			<div className="grid gap-2">
				<Label htmlFor={textId}>CSV</Label>
				<Textarea id={textId} value={text} onChange={handleTextChange} rows={6} className="font-mono text-xs" />
			</div>
			<DataTable data={rows} columns={columns} getRowId={getImportRowId} rowStatus={importRowStatus} heading={heading} />
		</div>
	);
}
