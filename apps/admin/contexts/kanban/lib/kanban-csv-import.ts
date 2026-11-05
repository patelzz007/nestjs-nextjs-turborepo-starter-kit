// ============================================
// contexts/kanban/lib/kanban-csv-import.ts - a CSV file → tasks to import
// ============================================
// Reads an RFC 4180 CSV (quoted fields, doubled quotes, CRLF or LF) with a
// header row, maps each row onto `CreateKanbanTaskSchema` and validates it
// with that schema — the same one `POST /admin/kanban/tasks/import` checks.
// Every row is reported: the import runs only when every row is valid.
//
// Columns (header names, any order, any case): title (required), type (one of
// the board's levels; blank = features on the planning board, stories on the
// execution board — a task needs its story, so it is added from the story's
// page), description, priority (high / medium / low), team, column (a column's
// title; blank = the first column), labels (comma-separated, quoted), points
// (stories), start and due (yyyy-MM-dd), progress (0–100).

import {
	BULK_MUTATION_MAX_ITEMS,
	CreateKanbanTaskSchema,
	KanbanItemTypeSchema,
	KanbanTaskPrioritySchema,
	KanbanTeamSchema,
	LIST_SLOT_INDEX,
	type CreateKanbanTaskInput,
	type KanbanBoardKind,
	type KanbanColumn,
	type KanbanItemType,
} from "@workspace/shared";

import { dateInputToEpochMs, labelsFromText } from "./kanban-task-form";

/** The level a row without a type becomes on each board. */
const DEFAULT_TYPE: Readonly<Record<KanbanBoardKind, KanbanItemType>> = { PLANNING: "FEATURE", EXECUTION: "STORY" };

const QUOTE = '"';
const COMMA = ",";
const LINE_FEED = "\n";
const CARRIAGE_RETURN = "\r";
/** The header row is line 1, so the first task is on line 2. */
const FIRST_DATA_LINE = 2;

/** Splits CSV text into rows of fields; a quoted field may hold commas, quotes (doubled) and line breaks. */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let inQuotes = false;
	let index = 0;
	while (index < text.length) {
		const character = text.charAt(index);
		if (inQuotes) {
			if (character === QUOTE && text.charAt(index + 1) === QUOTE) {
				field += QUOTE;
				index += 2;
				continue;
			}
			if (character === QUOTE) {
				inQuotes = false;
			} else {
				field += character;
			}
		} else if (character === QUOTE) {
			inQuotes = true;
		} else if (character === COMMA) {
			row.push(field);
			field = "";
		} else if (character === LINE_FEED || character === CARRIAGE_RETURN) {
			if (character === CARRIAGE_RETURN && text.charAt(index + 1) === LINE_FEED) {
				index += 1;
			}
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else {
			field += character;
		}
		index += 1;
	}
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

/** One row the import refuses, with why. */
export interface KanbanCsvProblem {
	readonly line: number;
	readonly message: string;
}

/** One row read, with the file line it came from (so the server's per-row report can name it too). */
export interface KanbanCsvTask {
	readonly line: number;
	readonly task: CreateKanbanTaskInput;
}

/**
 * What a file holds (enhancement 5.8): the rows that read cleanly and every row (or the file itself) refused, with
 * why. Both at once, so the good rows can import while the bad ones are skipped and listed.
 */
export interface KanbanCsvImport {
	readonly tasks: readonly KanbanCsvTask[];
	readonly problems: readonly KanbanCsvProblem[];
}

function fileRefused(message: string): KanbanCsvImport {
	return { tasks: [], problems: [{ line: 1, message }] };
}

/** One data row read: the task it describes, or why it cannot be imported. */
type KanbanCsvRow = { readonly ok: true; readonly task: CreateKanbanTaskInput } | { readonly ok: false; readonly message: string };

function refused(message: string): KanbanCsvRow {
	return { ok: false, message };
}

/** `value`, or `fallback` when the cell is blank. */
function orDefault(value: string, fallback: string): string {
	return value.length === 0 ? fallback : value;
}

function cell(cells: readonly string[], headers: readonly string[], name: string): string {
	const index = headers.indexOf(name);
	return index < 0 ? "" : (cells.at(index)?.trim() ?? "");
}

/** A `yyyy-MM-dd` cell → epoch ms; `null` when blank, `undefined` when it is not a date. */
function dateCell(text: string): number | null | undefined {
	if (text.length === 0) {
		return null;
	}
	return dateInputToEpochMs(text) ?? undefined;
}

function readRow(cells: readonly string[], headers: readonly string[], columns: readonly KanbanColumn[], board: KanbanBoardKind): KanbanCsvRow {
	const columnTitle = cell(cells, headers, "column").toLowerCase();
	const column = columnTitle.length === 0 ? columns.at(LIST_SLOT_INDEX.first) : columns.find((candidate) => candidate.title.toLowerCase() === columnTitle);
	if (column === undefined) {
		return refused(`No column is called "${cell(cells, headers, "column")}".`);
	}
	const type = KanbanItemTypeSchema.safeParse(orDefault(cell(cells, headers, "type"), DEFAULT_TYPE[board]).toUpperCase());
	if (!type.success) {
		return refused(`Type must be one of ${KanbanItemTypeSchema.options.map((option) => option.toLowerCase()).join(", ")}.`);
	}
	const dueAt = dateCell(cell(cells, headers, "due"));
	const startAt = dateCell(cell(cells, headers, "start"));
	if (dueAt === undefined || startAt === undefined) {
		return refused("Dates are written yyyy-MM-dd.");
	}
	const priority = KanbanTaskPrioritySchema.safeParse(orDefault(cell(cells, headers, "priority"), "medium").toUpperCase());
	if (!priority.success) {
		return refused("Priority must be high, medium or low.");
	}
	const team = KanbanTeamSchema.safeParse(orDefault(cell(cells, headers, "team"), "product").toUpperCase());
	if (!team.success) {
		return refused(`Team must be one of ${KanbanTeamSchema.options.map((option) => option.toLowerCase()).join(", ")}.`);
	}
	const progressText = cell(cells, headers, "progress");
	const pointsText = cell(cells, headers, "points");
	const parsed = CreateKanbanTaskSchema.safeParse({
		columnId: column.id,
		type: type.data,
		labels: labelsFromText(cell(cells, headers, "labels")),
		startAt,
		storyPoints: pointsText.length === 0 ? null : Number(pointsText),
		title: cell(cells, headers, "title"),
		description: cell(cells, headers, "description"),
		priority: priority.data,
		team: team.data,
		dueAt,
		progress: progressText.length === 0 ? 0 : Number(progressText),
	});
	if (!parsed.success) {
		return refused(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "));
	}
	return { ok: true, task: parsed.data };
}

/** The items a CSV file describes for one board's `columns`, and every row it refuses. */
export function readKanbanCsv(text: string, columns: readonly KanbanColumn[], board: KanbanBoardKind): KanbanCsvImport {
	const [header, ...rows] = parseCsv(text);
	if (header === undefined || rows.length === 0) {
		return fileRefused("The file needs a header row and at least one task.");
	}
	const headers = header.map((name) => name.trim().toLowerCase());
	if (!headers.includes("title")) {
		return fileRefused('The header row needs a "title" column.');
	}
	if (rows.length > BULK_MUTATION_MAX_ITEMS) {
		return fileRefused(`Import at most ${String(BULK_MUTATION_MAX_ITEMS)} tasks at a time.`);
	}
	const tasks: KanbanCsvTask[] = [];
	const problems: KanbanCsvProblem[] = [];
	rows.forEach((cells, index): void => {
		const row = readRow(cells, headers, columns, board);
		const line = index + FIRST_DATA_LINE;
		if (row.ok) {
			tasks.push({ line, task: row.task });
		} else {
			problems.push({ line, message: row.message });
		}
	});
	return { tasks, problems };
}
