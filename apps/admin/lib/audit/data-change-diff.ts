import { isStringPrimitive, JsonObjectSchema, type DataChangeLogDetail, type JsonObject, type JsonValue } from "@workspace/shared";

/** How one column fared in a row change. */
export type DataChangeColumnStatus = "changed" | "unchanged" | "added" | "removed";

/** One column of a row change, as the diff shows it. */
export interface DataChangeDiffRow {
	readonly column: string;
	/** `undefined` = the column is not in that image (an INSERT has no before, a DELETE no after). */
	readonly before: JsonValue | undefined;
	readonly after: JsonValue | undefined;
	readonly status: DataChangeColumnStatus;
}

/** Display order: what changed first, then the rest of the row. */
const STATUS_ORDER: Readonly<Record<DataChangeColumnStatus, number>> = { changed: 0, added: 0, removed: 0, unchanged: 1 };

/** A stored row image as columns; anything but a JSON object (never written by the trigger) shows as no columns. */
function columnsOf(image: JsonValue | null): JsonObject {
	const parsed = JsonObjectSchema.safeParse(image);
	return parsed.success ? parsed.data : {};
}

function statusOf(column: string, before: JsonObject, after: JsonObject, changed: ReadonlySet<string>): DataChangeColumnStatus {
	const isBefore: boolean = Object.hasOwn(before, column);
	const isAfter: boolean = Object.hasOwn(after, column);
	if (!isBefore) {
		return "added";
	}
	if (!isAfter) {
		return "removed";
	}
	return changed.has(column) ? "changed" : "unchanged";
}

/**
 * The column-by-column diff of one row change. For an UPDATE the "changed"
 * columns are the ones the database reported (`changedColumns`, compared
 * before redaction), so a changed secret is flagged although both of its
 * values read `[REDACTED]`. An INSERT's columns are all "added", a DELETE's
 * all "removed". Changed columns come first, each group in column-name order.
 */
export function buildDataChangeDiff(record: Pick<DataChangeLogDetail, "oldData" | "newData" | "changedColumns">): DataChangeDiffRow[] {
	const before: JsonObject = columnsOf(record.oldData);
	const after: JsonObject = columnsOf(record.newData);
	const changed: ReadonlySet<string> = new Set(record.changedColumns);
	const columns: string[] = [...new Set([...Object.keys(before), ...Object.keys(after)])];
	return columns
		.map((column: string): DataChangeDiffRow => ({
			column,
			before: before[column],
			after: after[column],
			status: statusOf(column, before, after, changed),
		}))
		.sort((left: DataChangeDiffRow, right: DataChangeDiffRow): number => STATUS_ORDER[left.status] - STATUS_ORDER[right.status] || left.column.localeCompare(right.column));
}

/** One stored value as text: strings as-is, everything else (numbers, booleans, objects, `null`) as JSON. */
export function formatDataChangeValue(value: JsonValue): string {
	return isStringPrimitive(value) ? value : JSON.stringify(value);
}
